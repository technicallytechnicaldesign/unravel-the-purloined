// Error control layer (packet section 24): framing, per-symbol checks,
// separator cells and a whole-message checksum, with a decoder that reports
// where things went wrong instead of dropping them.
//
// Pipeline position: SYMBOL ENCODER -> ERROR CONTROL -> logical grid. Bits in,
// bits out; a carrier decides later what a cell looks like in yarn.
//
// Stream layout, one block per symbol:
//   [START] [data]... [END] [checksum] [checksum]
//   block = code word (5, 6 or 9 cells) + optional separator cell

import { type Bit, BITS_PER_SYMBOL, START, END, encode as encodeSymbols, decode as decodeSymbols } from "./fivebit";

/** plain: 5 cells. parity: 5 + one even-parity cell. hamming: Hamming(9,5), repairs one flipped cell per symbol. */
export type SymbolCode = "plain" | "parity" | "hamming";

export interface ErrorControlOptions {
  code: SymbolCode;
  /** A fixed cell after every symbol, so a dropped or added cell shows up where it happened. */
  separator: boolean;
  /** Two checksum symbols after END. */
  checksum: boolean;
}

export const DEFAULT_OPTIONS: ErrorControlOptions = { code: "parity", separator: true, checksum: true };

/** Value of every separator cell. */
export const SEPARATOR: Bit = 1;

const START_VALUE = 28;
const END_VALUE = 29;
const CHECKSUM_SYMBOLS = 2;
const REPLACEMENT = "�";

export type Region = "start" | "data" | "end" | "checksum" | "stream";

export interface Issue {
  kind:
    | "parity"
    | "corrected"
    | "uncorrectable"
    | "separator"
    | "slip"
    | "framing"
    | "invalid-symbol"
    | "checksum"
    | "trailing";
  region: Region;
  /** 1-based character in the message, for data-region issues. */
  character?: number;
  /** For a slip that could sit in a range: the last place it could be, counted like `character` (START is 0). */
  through?: number;
  /** 0-based index of the cell concerned, in the stream as given. */
  cell: number;
  message: string;
}

export interface FrameReport {
  text: string;
  /** True when nothing needs a human look; repaired cells alone still count as ok. */
  ok: boolean;
  /** Sorted by cell, so issues[0] is the first problem in reading order. */
  issues: Issue[];
  /** Cell where START began. Negative means leading cells were missing. */
  offset: number;
}

export const codeLength = (code: SymbolCode): number => ({ plain: 5, parity: 6, hamming: 9 })[code];
export const blockLength = (o: ErrorControlOptions): number => codeLength(o.code) + (o.separator ? 1 : 0);

function valueBits(v: number): Bit[] {
  const bits: Bit[] = [];
  for (let i = BITS_PER_SYMBOL - 1; i >= 0; i--) bits.push(((v >> i) & 1) as Bit);
  return bits;
}

const bitsValue = (bits: readonly Bit[]): number => bits.reduce<number>((v, b) => (v << 1) | b, 0);
const ones = (bits: readonly Bit[]): number => bits.filter((b) => b === 1).length;

// Hamming(9,5): cells are positions 1..9, checks at 1, 2, 4, 8 and data at the rest.
// The syndrome (XOR of positions holding a 1) is 0 for a clean word and names the flipped position otherwise.
const DATA_POSITIONS = [3, 5, 6, 7, 9];
const syndrome = (word: readonly Bit[]): number => word.reduce<number>((s, b, i) => (b ? s ^ (i + 1) : s), 0);

export function encodeWord(value: number, code: SymbolCode): Bit[] {
  const data = valueBits(value);
  if (code === "plain") return data;
  if (code === "parity") return [...data, (ones(data) % 2) as Bit];
  const word: Bit[] = new Array<Bit>(9).fill(0);
  DATA_POSITIONS.forEach((p, i) => (word[p - 1] = data[i]!));
  const s = syndrome(word);
  for (const p of [1, 2, 4, 8]) if (s & p) word[p - 1] = 1;
  return word;
}

interface Word {
  value: number;
  /** Passed its check, possibly after a repair. */
  ok: boolean;
  /** Index within the word of a cell the Hamming code repaired. */
  corrected?: number;
}

export function decodeWord(word: readonly Bit[], code: SymbolCode): Word {
  if (code === "plain") return { value: bitsValue(word), ok: true };
  if (code === "parity") return { value: bitsValue(word.slice(0, 5)), ok: ones(word) % 2 === 0 };
  const s = syndrome(word);
  const data = (w: readonly Bit[]) => bitsValue(DATA_POSITIONS.map((p) => w[p - 1]!));
  if (s === 0) return { value: data(word), ok: true };
  if (s > 9) return { value: data(word), ok: false };
  const fixed = word.slice();
  fixed[s - 1] = (1 - fixed[s - 1]!) as Bit;
  return { value: data(fixed), ok: true, corrected: s - 1 };
}

/** Fletcher-style pair, mod 32: the first sum catches any changed symbol, the second catches swapped ones. */
export function checksum(values: readonly number[]): [number, number] {
  let a = 0;
  let b = 0;
  for (const v of values) {
    a = (a + v) % 32;
    b = (b + a) % 32;
  }
  return [a, b];
}

/** Frame normalized text: START, symbols, END, optional checksum, each block checked and separated as chosen. */
export function encodeFrame(text: string, options: ErrorControlOptions = DEFAULT_OPTIONS): Bit[] {
  if (text.includes(START) || text.includes(END)) {
    throw new Error("START and END are framing controls; they cannot appear inside the message.");
  }
  const bits = encodeSymbols(text);
  const values: number[] = [];
  for (let i = 0; i < bits.length; i += BITS_PER_SYMBOL) values.push(bitsValue(bits.slice(i, i + BITS_PER_SYMBOL)));
  const all = [START_VALUE, ...values, END_VALUE, ...(options.checksum ? checksum(values) : [])];
  return all.flatMap((v) => [...encodeWord(v, options.code), ...(options.separator ? [SEPARATOR] : [])]);
}

const slice = (bits: readonly Bit[], from: number, n: number): Bit[] => bits.slice(from, from + n);

/** True when the word at p passes its check with no repair needed. */
function clean(bits: readonly Bit[], p: number, o: ErrorControlOptions): boolean {
  const w = decodeWord(slice(bits, p, codeLength(o.code)), o.code);
  return w.ok && w.corrected === undefined;
}

// Score a guess at where START begins. An intact START pattern outweighs everything
// else, then the first few blocks after it; the fit of the total length and the END
// marker break ties. Each cell of distance from 0 costs a point: stray leading cells are rare.
// Scoring a fixed window keeps a mid-message slip from dragging the frame with it.
// Cells before 0 are unknown and match anything.
const LOOKAHEAD = 4;
const MAX_MISSING = 2;

function scoreOffset(bits: readonly Bit[], off: number, o: ErrorControlOptions): number {
  const B = blockLength(o);
  const W = codeLength(o.code);
  const start = encodeWord(START_VALUE, o.code);
  let score = start.every((b, i) => off + i < 0 || bits[off + i] === b) ? 2 * LOOKAHEAD + 2 : 0;
  score -= Math.abs(off);
  if ((bits.length - off) % B === 0) score++;
  for (let k = 0; k <= LOOKAHEAD; k++) {
    const p = off + k * B;
    if (p + B > bits.length) break;
    if (o.separator && bits[p + W] === SEPARATOR) score++;
    if (k > 0 && o.code !== "plain" && clean(bits, p, o)) score++;
  }
  const endK = Math.floor((bits.length - off) / B) - 1 - (o.checksum ? CHECKSUM_SYMBOLS : 0);
  if (endK > 0 && decodeWord(slice(bits, off + endK * B, W), o.code).value === END_VALUE) score++;
  return score;
}

function findOffset(bits: readonly Bit[], o: ErrorControlOptions): number {
  const B = blockLength(o);
  let best = 0;
  let bestScore = -1;
  for (let off = -MAX_MISSING; off <= Math.min(bits.length, 2 * B); off++) {
    const s = scoreOffset(bits, off, o);
    if (s > bestScore || (s === bestScore && Math.abs(off) < Math.abs(best))) [best, bestScore] = [off, s];
  }
  return best;
}

// After a bad separator, decide whether a cell was dropped (-1), added (+1) or just flipped (0)
// by checking which reading makes the next two blocks line up. Ties keep 0.
function bestShift(bits: readonly Bit[], next: number, o: ErrorControlOptions): number {
  const B = blockLength(o);
  const W = codeLength(o.code);
  const score = (s: number) => {
    let sc = (bits.length - (next + s)) % B === 0 ? 1 : 0;
    for (let k = 0; k < 2; k++) {
      const p = next + s + k * B;
      if (p + B > bits.length) break;
      if (bits[p + W] === SEPARATOR) sc++;
      if (clean(bits, p, o)) sc++;
    }
    return sc;
  };
  let best = 0;
  for (const s of [-1, 1]) if (score(s) > score(best)) best = s;
  return best;
}

interface Block {
  cell: number;
  word: Word;
  separatorOk: boolean;
  /** -1 a cell was dropped, +1 one was added; blocks after this one were read shifted. */
  shift: number;
  /** Block indexes between which that slip could have happened. */
  slipFrom: number;
  slipTo: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Unframe a cell stream and report every problem with its place in the message. */
export function decodeFrame(bits: readonly Bit[], options: ErrorControlOptions = DEFAULT_OPTIONS): FrameReport {
  const B = blockLength(options);
  const W = codeLength(options.code);
  const issues: Issue[] = [];
  const offset = findOffset(bits, options);

  // START: missing leading cells are filled in from the known pattern.
  if (offset < 0) {
    const start = encodeWord(START_VALUE, options.code);
    const damaged = start.some((b, i) => offset + i >= 0 && bits[offset + i] !== b);
    issues.push({
      kind: "framing",
      region: "start",
      cell: 0,
      message: `${plural(-offset, "leading cell")} missing; START marker filled in from its known pattern${damaged ? ", and what remains of it is damaged" : ""}.`,
    });
  } else if (offset > 0) {
    issues.push({ kind: "framing", region: "stream", cell: 0, message: `${plural(offset, "extra cell")} before START ignored.` });
  }

  const read = (at: number): Block => ({
    cell: at,
    word: at < 0 ? { value: START_VALUE, ok: true } : decodeWord(slice(bits, at, W), options.code),
    separatorOk: !options.separator || bits[at + W] === SEPARATOR,
    shift: 0,
    slipFrom: 0,
    slipTo: 0,
  });
  const readsClean = (b: Block) => b.separatorOk && b.word.ok && b.word.corrected === undefined;
  const endAt = (bs: readonly Block[]) => bs.length - 1 - (options.checksum ? CHECKSUM_SYMBOLS : 0);
  const endOk = (bs: readonly Block[]) => endAt(bs) >= 1 && bs[endAt(bs)]!.word.value === END_VALUE;
  const checksumOk = (bs: readonly Block[]) => {
    const [a, b] = checksum(bs.slice(1, endAt(bs)).map((x) => x.word.value));
    return bs[endAt(bs) + 1]!.word.value === a && bs[endAt(bs) + 2]!.word.value === b;
  };

  const blocks: Block[] = [];
  let p = offset;
  while (p + B <= bits.length) {
    const b = read(p);
    blocks.push(b);
    if (!b.separatorOk) {
      b.shift = bestShift(bits, p + B, options);
      // A slip is only noticed at the first separator it spoils. Earlier blocks that
      // also read cleanly one cell over could hold it too, so report the whole range.
      let m = blocks.length - 1;
      while (b.shift !== 0 && m > 1 && readsClean(read(blocks[m]!.cell + b.shift))) m--;
      [b.slipFrom, b.slipTo] = [m, blocks.length - 1];
    }
    p += B + b.shift;
  }

  // The end of the stream is a second anchor. A slip that no separator caught leaves
  // the END marker out of place and a part-block over; try each place the slip could
  // be, keep those that put END back, and let the checksum choose if it can.
  const shift = bits.length - p === B - 1 ? -1 : bits.length - p === 1 ? 1 : 0;
  if (shift !== 0 && !endOk(blocks) && blocks.length > 1) {
    const last = blocks.length - 1;
    let m = last;
    while (m > 1 && readsClean(read(blocks[m]!.cell + shift))) m--;
    const splits: { at: number; blocks: Block[] }[] = [];
    for (let at = m; at <= last; at++) {
      const out = blocks.slice(0, at + 1).map((b) => ({ ...b }));
      for (let q = blocks[at]!.cell + B + shift; q + B <= bits.length; q += B) out.push(read(q));
      if (endOk(out)) splits.push({ at, blocks: out });
    }
    const agree = options.checksum ? splits.filter((c) => checksumOk(c.blocks)) : [];
    const pool = agree.length ? agree : splits;
    if (pool.length) {
      // Keep the forward reading as long as possible and report the whole range. With the
      // switch after block `at`, the slip sits in block `at` or the one after it.
      const pick = pool.at(-1)!;
      Object.assign(pick.blocks[pick.at]!, { shift, slipFrom: pool[0]!.at, slipTo: pick.at + 1 });
      blocks.splice(0, blocks.length, ...pick.blocks);
      p = blocks.at(-1)!.cell + B;
    }
  }

  const endIndex = endAt(blocks);
  const region = (i: number): Region =>
    i === 0 ? "start" : i < endIndex ? "data" : i === endIndex ? "end" : "checksum";
  const where = (i: number) =>
    ({ start: "the START marker", data: `character ${i}`, end: "the END marker", checksum: "the checksum", stream: "the stream" })[region(i)];

  let text = "";
  blocks.forEach((b, i) => {
    const r = region(i);
    const at = r === "data" ? { region: r, character: i } : { region: r };
    const cell = Math.max(b.cell, 0);
    if (!b.word.ok) {
      issues.push({
        kind: options.code === "hamming" ? "uncorrectable" : "parity",
        ...at,
        cell,
        message: `Possible error near ${where(i)} (cells ${cell + 1} to ${b.cell + W}).`,
      });
    } else if (b.word.corrected !== undefined) {
      const c = b.cell + b.word.corrected;
      issues.push({ kind: "corrected", ...at, cell: c, message: `Error at cell ${c + 1}, in ${where(i)}: repaired.` });
    }
    if (b.shift !== 0) {
      const [from, to] = [b.slipFrom, b.slipTo];
      const range = from === to ? `near ${where(from)}` : `somewhere from ${where(from)} to ${where(to)}`;
      issues.push({
        kind: "slip",
        ...(region(from) === "data" ? { region: region(from), character: from } : { region: region(from) }),
        cell: Math.max(blocks[from]!.cell, 0),
        ...(from === to ? {} : { through: to }),
        message: `A cell seems to be ${b.shift < 0 ? "missing" : "added"} ${range}; reading resynchronised after it.`,
      });
    } else if (!b.separatorOk) {
      issues.push({ kind: "separator", ...at, cell: b.cell + W, message: `Separator after ${where(i)} is wrong (cell ${b.cell + W + 1}).` });
    }
    if (r === "start" && b.cell >= 0 && b.word.value !== START_VALUE) {
      issues.push({ kind: "framing", region: r, cell, message: "START marker is damaged." });
    }
    if (r === "end" && b.word.value !== END_VALUE) {
      issues.push({ kind: "framing", region: r, cell, message: `END marker is missing or damaged (expected at cell ${cell + 1}).` });
    }
    if (r === "data") {
      const ch = decodeSymbols(valueBits(b.word.value)).text;
      if (ch === "" || ch === START || ch === END) {
        issues.push({ kind: "invalid-symbol", ...at, cell, message: `Character ${i} has no meaning in the alphabet (value ${b.word.value}).` });
        text += REPLACEMENT;
      } else text += ch;
    }
  });

  if (endIndex < 1) {
    issues.push({ kind: "framing", region: "stream", cell: 0, message: "Too few cells to hold START, END and the checksum." });
  } else if (options.checksum) {
    const expected = checksum(blocks.slice(1, endIndex).map((b) => b.word.value));
    const got = blocks.slice(endIndex + 1).map((b) => b.word.value);
    if (expected[0] !== got[0] || expected[1] !== got[1]) {
      const located = issues.some((i) => i.region === "data" && i.kind !== "corrected");
      issues.push({
        kind: "checksum",
        region: "checksum",
        cell: blocks[endIndex + 1]!.cell,
        message: located
          ? "Checksum does not match, which agrees with the errors above."
          : "Checksum does not match: something in the message is wrong, but the per-symbol checks did not find where.",
      });
    }
  }

  if (p < bits.length) {
    issues.push({ kind: "trailing", region: "stream", cell: Math.max(p, 0), message: `${plural(bits.length - p, "cell")} left over after the last whole symbol.` });
  }

  issues.sort((a, b) => a.cell - b.cell);
  return { text, ok: issues.every((i) => i.kind === "corrected"), issues, offset };
}
