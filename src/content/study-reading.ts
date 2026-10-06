import { decode, START, END, type Bit } from "../engine/fivebit";
import { blockLength, codeLength, decodeWord, decodeFrame, DEFAULT_OPTIONS, type ErrorControlOptions } from "../engine/errorcontrol";
import { dataCellOrder, readGrid, type Cell } from "../engine/grid";

export interface StudyWindow { leftCol: number; rightCol: number; bottomRow: number; topRow: number; }
export interface ReadingPlan { cells: Cell[]; messageSymbols: number; topRow: number; options: ErrorControlOptions; }
export interface ReadingSymbol { glyph: string; state: "waiting" | "partial" | "complete" | "error"; bits: string; cells: Cell[]; known: number; }
export interface LiveReading { symbols: ReadingSymbol[]; active: number; text: string; status: string; }

/** Calibrate from the documented full pattern; keep positions and counts, never future letter values. */
export function readingPlan(rows: readonly string[], window: StudyWindow, options = DEFAULT_OPTIONS): ReadingPlan {
  const cropped = rows.slice(window.bottomRow - 1, window.topRow + 1).map(r => [...r.slice(window.leftCol, window.rightCol + 1)].map(c => (c === "p" ? 1 : 0) as Bit));
  const grid = readGrid(cropped, false);
  const frame = decodeFrame(grid.bits, options);
  if (grid.issues.length || !frame.ok || frame.offset !== 0) throw new Error("The documented study key does not match this pattern.");
  return {
    cells: dataCellOrder(cropped.length, cropped[0]!.length, false).slice(0, grid.bits.length).map(([r, c]) => [r + window.bottomRow - 1, c + window.leftCol]),
    messageSymbols: frame.text.length, topRow: window.topRow + 1, options,
  };
}

const glyph = (bits: readonly Bit[]): string => {
  const text = decode(bits).text;
  return text === START ? "START" : text === END ? "END" : text || "?";
};

/** Missing fabric remains unknown. A padded candidate is visibly provisional until every check cell exists. */
export function readProgress(rows: readonly string[], completedRows: number, plan: ReadingPlan, useKey = true): LiveReading {
  const remaining = Math.max(0, Math.min(rows.length, Math.floor(completedRows)));
  const cells: Cell[] = useKey ? plan.cells : rows.slice(0, remaining).flatMap((r, row) => [...r].map((_, i) => [row, r.length - 1 - i] as Cell));
  const width = useKey ? blockLength(plan.options) : 5;
  const first = useKey ? 1 : 0;
  const count = useKey ? plan.messageSymbols : Math.ceil(cells.length / width);
  const symbols: ReadingSymbol[] = [];
  for (let i = first; i < first + count; i++) {
    const positions = cells.slice(i * width, (i + 1) * width);
    const known = positions.filter(([r]) => r < remaining).length;
    const values = positions.map(([r, c]) => r < remaining ? (rows[r]![c] === "p" ? 1 : 0) as Bit : null);
    const candidate = [...values.slice(0, 5), ...Array(Math.max(0, 5 - values.length)).fill(null)].map(v => (v ?? 0) as Bit);
    const full = known === width;
    const valid = !useKey || (full && decodeWord(values.slice(0, codeLength(plan.options.code)) as Bit[], plan.options.code).ok && (!plan.options.separator || values.at(-1) === 1));
    symbols.push({ glyph: known ? glyph(candidate) : "", state: !known ? "waiting" : !full ? "partial" : valid ? "complete" : "error", bits: values.map(v => v === null ? "?" : String(v)).join("").padEnd(width, "?"), cells: positions.filter(([r]) => r < remaining), known });
  }
  const partial = symbols.findIndex(s => s.state === "partial");
  const active = partial >= 0 ? partial : symbols.map(s => s.known > 0).lastIndexOf(true);
  const text = symbols.filter(s => s.state === "complete").map(s => s.glyph).join("");
  let status = useKey ? "Read inside the message window, right to left and bottom to top. Five letter bits, parity, separator." : "Reading every stitch as five-bit text: the garter frame, checks and separators become letters too.";
  if (useKey && remaining >= plan.topRow) {
    const frame = decodeFrame(plan.cells.map(([r, c]) => (rows[r]![c] === "p" ? 1 : 0) as Bit), plan.options);
    status += frame.ok ? " Full frame and checksum pass." : " Frame or checksum needs checking.";
  } else if (useKey) status += " The full frame is incomplete.";
  return { symbols, active, text, status };
}
