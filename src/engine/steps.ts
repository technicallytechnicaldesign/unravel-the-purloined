// Every intermediate step between a grid of cells and text (packet section 28):
// orientation, bit stream, one line per symbol, the text, and findings that
// point back to the cells they are about. Shared by the encoder view (to show
// what it made) and the manual decoder (to show what it read).

import { type Bit } from "./fivebit";
import * as fivebit from "./fivebit";
import * as morse from "./morse";
import * as bacon from "./bacon";
import { blockLength, codeLength, decodeFrame, decodeWord } from "./errorcontrol";
import { dataCellOrder, describe as describeOrientation, mapCell, readGrid, type Cell, type Orientation, type Edge } from "./grid";
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

/** Cells as a knitter would say them: "row 6, stitches 3 to 8; row 7, stitch 1". Stitch 1 is on the right. */
export function describeCells(cells: readonly Cell[], width: number): string {
  const byRow = new Map<number, number[]>();
  for (const [r, c] of cells) byRow.set(r, [...(byRow.get(r) ?? []), width - c]);
  return [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([r, sts]) => {
      const sorted = [...new Set(sts)].sort((a, b) => a - b);
      const runs: string[] = [];
      for (let i = 0; i < sorted.length; ) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
        runs.push(i === j ? String(sorted[i]) : `${sorted[i]} to ${sorted[j]}`);
        i = j + 1;
      }
      const many = sorted.length > 1;
      return `row ${r + 1}, stitch${many ? "es" : ""} ${runs.join(", ")}`;
    })
    .join("; ");
}

/** Swap stream positions in an engine message ("cells 43 to 48", "cell 83", "unit 9") for rows and stitches. */
function relocate(message: string, cells: readonly Cell[], width: number): string {
  const where = cells.length ? describeCells(cells, width) : "";
  const stream = /\b(?:cells? \d+(?: to \d+)?|unit \d+)\b/;
  if (!stream.test(message)) return where ? `${message} (${where})` : message;
  if (!where) return message.replace(/ \((?:cells? \d+(?: to \d+)?)\)/, "");
  return message.replace(stream, where);
}

/** Read a grid of cells through every step back to text. */
export function decodeCells(cells: readonly (readonly Bit[])[], border: Edge, encoding: EncodingSettings): DecodeSteps {
  const g = readGrid(cells, border);
  const height = cells.length;
  const width = cells[0]?.length ?? 0;
  const order = height ? dataCellOrder(height, width, border) : [];
  const toCells = ([from, to]: Span): Cell[] =>
    order.slice(Math.max(from, 0), Math.max(to, 0)).map((c) => mapCell(c, g.orientation, height, width));

  const findings: Finding[] = g.issues.map((i) => {
    const at = (i.cells ?? []).map((c) => mapCell(c, g.orientation, height, width));
    return { severity: i.kind === "orientation" ? "note" : "error", message: relocate(i.message, at, width), cells: at };
  });
  const d = decodeStream(g.bits, encoding, toCells, width);
  findings.push(...d.findings);
  return {
    orientation: g.orientation,
    orientationText: describeOrientation(g.orientation),
    bits: g.bits,
    symbols: d.symbols,
    text: d.text,
    findings,
    ok: findings.every((f) => f.severity === "note"),
  };
}

export type Span = [from: number, to: number];

/**
 * Decode a bit stream in an alphabet: symbols, text, and findings whose cells
 * come from `toCells` (stream positions to cells in the grid as given).
 * `width` is the grid width, for naming stitches.
 */
export function decodeStream(bits: readonly Bit[], encoding: EncodingSettings, toCells: (span: Span) => Cell[], width: number): { text: string; symbols: SymbolStep[]; findings: Finding[] } {
  const findings: Finding[] = [];
  if (encoding.alphabet === "fivebit") {
    const o = encoding.errorControl;
    const B = blockLength(o);
    const W = codeLength(o.code);
    const r = decodeFrame(bits, o);
    for (const i of r.issues) {
      const span: Span | undefined =
        i.kind === "corrected" || i.kind === "separator" ? [i.cell, i.cell + 1]
        : i.kind === "checksum" ? [i.cell, i.cell + 2 * B]
        : i.kind === "trailing" ? [i.cell, bits.length]
        : i.kind === "framing" ? (i.region === "start" ? [Math.max(r.offset, 0), r.offset + W] : undefined)
        : [i.cell, i.cell + W];
      const at = span ? toCells(span) : [];
      findings.push({ severity: i.kind === "corrected" ? "note" : "error", message: relocate(i.message, at, width), cells: at });
    }
    return { text: r.text, symbols: describeStream(bits, encoding, r.offset), findings };
  }
  if (encoding.alphabet === "bacon") {
    const r = bacon.decode(bits, encoding.variant);
    findings.push({ severity: "note", message: r.label, cells: [] });
    for (const grp of r.invalidGroups) {
      const at = toCells([grp * 5, grp * 5 + 5]);
      findings.push({ severity: "error", message: relocate(`Group ${grp + 1} has no letter in this alphabet.`, at, width), cells: at });
    }
    if (r.ambiguous.length) {
      findings.push({ severity: "note", message: `Could be either letter at ${r.ambiguous.map((a) => `${a.position} (${a.letters.split("").join("/")})`).join(", ")}.`, cells: [] });
    }
    if (r.trailingBits) findings.push({ severity: "error", message: `${r.trailingBits} cells left over after the last group of five.`, cells: toCells([bits.length - r.trailingBits, bits.length]) });
    return { text: r.text, symbols: describeStream(bits, encoding), findings };
  }
  const r = morse.decodeUnits(bits);
  for (const i of r.issues) {
    const at = i.unit === undefined ? [] : toCells([i.unit, i.unit + 1]);
    findings.push({ severity: "error", message: relocate(i.message, at, width), cells: at });
  }
  return { text: r.text, symbols: describeStream(bits, encoding), findings };
}
