// Every intermediate step between a grid of cells and text (packet section 28):
// orientation, bit stream, one line per symbol, the text, and findings that
// point back to the cells they are about. Shared by the encoder view (to show
// what it made) and the manual decoder (to show what it read).

import { type Bit } from "./fivebit";
import * as fivebit from "./fivebit";
import * as morse from "./morse";
import * as bacon from "./bacon";
import { blockLength, codeLength, decodeFrame, decodeWord } from "./errorcontrol";
import { dataCellOrder, describe as describeOrientation, mapCell, readGrid, type Cell, type Orientation } from "./grid";
import { type EncodingSettings } from "./project";

export interface SymbolStep {
  /** What the symbol is for: "START", "1", "END", "sum". */
  label: string;
  /** Its cells as 0/1 text, with "|" before a separator cell and "?" for a missing cell. */
  cells: string;
  value?: number;
  /** What it decodes to. */
  out: string;
  flagged: boolean;
}

export interface Finding {
  severity: "error" | "note";
  message: string;
  /** Cells it concerns, in the grid as given. */
  cells: Cell[];
}

export interface DecodeSteps {
  orientation: Orientation;
  orientationText: string;
  bits: Bit[];
  symbols: SymbolStep[];
  text: string;
  findings: Finding[];
  ok: boolean;
}

const bitsOf = (v: number): Bit[] => [4, 3, 2, 1, 0].map((i) => ((v >> i) & 1) as Bit);
const charOf = (v: number): string => {
  const ch = fivebit.decode(bitsOf(v)).text;
  return ch === " " ? "space" : ch === fivebit.START ? "START" : ch === fivebit.END ? "END" : ch || "?";
};

/** One line per symbol of a stream, as the encoding reads it. `offset` is where START begins. */
export function describeStream(bits: readonly Bit[], encoding: EncodingSettings, offset = 0): SymbolStep[] {
  if (encoding.alphabet === "bacon") {
    const out: SymbolStep[] = [];
    for (let g = 0; g + 5 <= bits.length; g += 5) {
      const group = bits.slice(g, g + 5);
      const r = bacon.decode(group, encoding.variant);
      const ch = r.text;
      const pair = r.ambiguous[0]?.letters;
      out.push({ label: String(g / 5 + 1), cells: bacon.toAB(group), value: group.reduce<number>((v, b) => (v << 1) | b, 0), out: pair ? `${pair[0]}/${pair[1]}` : ch, flagged: r.invalidGroups.length > 0 });
    }
    return out;
  }
  if (encoding.alphabet === "morse") {
    const out: SymbolStep[] = [];
    let code = "";
    const flush = () => {
      if (!code) return;
      const text = morse.decode(Array.from(code).flatMap((m, i): morse.MorseElement[] => [...(i ? ["symbolGap" as const] : []), m === "." ? "dot" : "dash"])).text;
      out.push({ label: String(out.filter((s) => s.label !== "gap").length + 1), cells: code, out: text, flagged: text === "�" });
      code = "";
    };
    for (const e of morse.readUnits(bits)) {
      if (e === "dot" || e === "dash") code += e === "dot" ? "." : "-";
      else if (e !== "symbolGap") {
        flush();
        if (e === "wordGap") out.push({ label: "gap", cells: "/", out: "space", flagged: false });
      }
    }
    flush();
    return out;
  }

  const o = encoding.errorControl;
  const B = blockLength(o);
  const W = codeLength(o.code);
  const n = Math.floor((bits.length - offset) / B);
  const endIndex = n - 1 - (o.checksum ? 2 : 0);
  const out: SymbolStep[] = [];
  for (let k = 0; k < n; k++) {
    const p = offset + k * B;
    const cells = Array.from({ length: B }, (_, i) => (i === W ? "|" : "") + String(bits[p + i] ?? "?")).join("");
    const word = decodeWord(bits.slice(Math.max(p, 0), p + W), o.code);
    const label = k === 0 ? "START" : k < endIndex ? String(k) : k === endIndex ? "END" : "sum";
    const sepOk = !o.separator || bits[p + W] === 1;
    out.push({
      label,
      cells,
      value: word.value,
      out: label === "sum" ? String(word.value) : charOf(word.value),
      flagged: p >= 0 && (!word.ok || word.corrected !== undefined || !sepOk),
    });
  }
  return out;
}

type Span = [from: number, to: number];

/** Read a grid of cells through every step back to text. */
export function decodeCells(cells: readonly (readonly Bit[])[], border: boolean, encoding: EncodingSettings): DecodeSteps {
  const g = readGrid(cells, border);
  const height = cells.length;
  const width = cells[0]?.length ?? 0;
  const order = height ? dataCellOrder(height, width, border) : [];
  const toCells = ([from, to]: Span): Cell[] =>
    order.slice(Math.max(from, 0), Math.max(to, 0)).map((c) => mapCell(c, g.orientation, height, width));

  const findings: Finding[] = g.issues.map((i) => ({ severity: i.kind === "orientation" ? "note" : "error", message: i.message, cells: [] }));
  let text = "";
  let symbols: SymbolStep[] = [];

  if (encoding.alphabet === "fivebit") {
    const o = encoding.errorControl;
    const B = blockLength(o);
    const W = codeLength(o.code);
    const r = decodeFrame(g.bits, o);
    text = r.text;
    symbols = describeStream(g.bits, encoding, r.offset);
    for (const i of r.issues) {
      const span: Span | undefined =
        i.kind === "corrected" || i.kind === "separator" ? [i.cell, i.cell + 1]
        : i.kind === "checksum" ? [i.cell, i.cell + 2 * B]
        : i.kind === "trailing" ? [i.cell, g.bits.length]
        : i.kind === "framing" ? (i.region === "start" ? [Math.max(r.offset, 0), r.offset + W] : undefined)
        : [i.cell, i.cell + W];
      findings.push({ severity: i.kind === "corrected" ? "note" : "error", message: i.message, cells: span ? toCells(span) : [] });
    }
  } else if (encoding.alphabet === "bacon") {
    const r = bacon.decode(g.bits, encoding.variant);
    text = r.text;
    symbols = describeStream(g.bits, encoding);
    findings.push({ severity: "note", message: r.label, cells: [] });
    for (const grp of r.invalidGroups) findings.push({ severity: "error", message: `Group ${grp + 1} has no letter in this alphabet.`, cells: toCells([grp * 5, grp * 5 + 5]) });
    if (r.ambiguous.length) {
      findings.push({ severity: "note", message: `Could be either letter at ${r.ambiguous.map((a) => `${a.position} (${a.letters.split("").join("/")})`).join(", ")}.`, cells: [] });
    }
    if (r.trailingBits) findings.push({ severity: "error", message: `${r.trailingBits} cells left over after the last group of five.`, cells: toCells([g.bits.length - r.trailingBits, g.bits.length]) });
  } else {
    const r = morse.decodeUnits(g.bits);
    text = r.text;
    symbols = describeStream(g.bits, encoding);
    for (const i of r.issues) findings.push({ severity: "error", message: i.message, cells: i.unit === undefined ? [] : toCells([i.unit, i.unit + 1]) });
  }

  return {
    orientation: g.orientation,
    orientationText: describeOrientation(g.orientation),
    bits: g.bits,
    symbols,
    text,
    findings,
    ok: findings.every((f) => f.severity === "note"),
  };
}
