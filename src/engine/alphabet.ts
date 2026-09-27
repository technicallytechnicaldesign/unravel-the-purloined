// Design your own alphabet (Phase 7): drawn symbols, one per character, used
// like the built-in motif alphabets. This module checks an alphabet, suggests
// symbols, reads and writes alphabet files and draws a printable legend.
//
// Symbols are stored as rows of "x" (purl, or colour B) and "." (knit, or
// colour A), top row first, so a file is readable by eye. Space is always
// the blank symbol, which also pads the end of the last line.

import { type Bit } from "./fivebit";
import { transform, describe } from "./grid";
import { distance, ORIENTATIONS, type Pack } from "./glyphs";

export const ALPHABET_FORMAT = "unravel-the-purloined/alphabet";
export const ALPHABET_VERSION = 1;
export const MIN_SIZE = 3;
export const MAX_SIZE = 6;

export interface Alphabet {
  format: typeof ALPHABET_FORMAT;
  version: typeof ALPHABET_VERSION;
  name: string;
  width: number;
  height: number;
  /** Character to rows, top first: "x" purl or colour B, "." knit or colour A. */
  symbols: Record<string, string[]>;
}

export type Severity = "problem" | "warning" | "note";

export interface Finding {
  kind: "size" | "character" | "blank" | "duplicate" | "close" | "turned" | "faint";
  severity: Severity;
  /** The characters concerned. */
  chars: string[];
  message: string;
}

export interface AlphabetCheck {
  findings: Finding[];
  /** Fewest stitches between any two symbols, read upright. */
  minDistance: number;
  /** Fewest stitches between a symbol turned, mirrored or inverted and any other symbol. */
  turnDistance: number;
  /** What one slipped stitch does, in a sentence. */
  slip: string;
  /** False when any finding is a problem: the alphabet cannot be used until it is fixed. */
  usable: boolean;
}

/** A new alphabet with only the blank space drawn. */
export function emptyAlphabet(name: string, width: number, height: number): Alphabet {
  return { format: ALPHABET_FORMAT, version: ALPHABET_VERSION, name, width, height, symbols: { " ": blankRows(width, height) } };
}

const blankRows = (w: number, h: number): string[] => Array.from({ length: h }, () => ".".repeat(w));

/** Rows (top first) to cells (row 0 at the bottom), as the grid and glyph modules use. */
export const toCells = (rows: readonly string[]): Bit[][] => rows.map((r) => [...r].map((ch) => (ch === "x" ? 1 : 0) as Bit)).reverse();
export const toRows = (cells: readonly (readonly Bit[])[]): string[] => [...cells].reverse().map((r) => r.map((b) => (b ? "x" : ".")).join(""));

const label = (ch: string) => (ch === " " ? "space" : `"${ch}"`);
const TURN_NAMES = ORIENTATIONS.slice(1).map((o) => describe(o));

/** Check an alphabet and say, finding by finding, what would go wrong in fabric. */
export function checkAlphabet(a: Alphabet): AlphabetCheck {
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);
  const cells = a.width * a.height;
  if (!(a.width >= MIN_SIZE && a.width <= MAX_SIZE && a.height >= MIN_SIZE && a.height <= MAX_SIZE))
    add({ kind: "size", severity: "problem", chars: [], message: `Symbols are ${a.width} × ${a.height}; each side must be ${MIN_SIZE} to ${MAX_SIZE} stitches.` });
  const good: [string, Bit[][]][] = [];
  for (const [ch, rows] of Object.entries(a.symbols)) {
    if ([...ch].length !== 1) add({ kind: "character", severity: "problem", chars: [ch], message: `"${ch}" is more than one character; each symbol stands for exactly one.` });
    else if (ch !== ch.toUpperCase()) add({ kind: "character", severity: "problem", chars: [ch], message: `"${ch}" is lower case. Messages are read in capitals, so use "${ch.toUpperCase()}" instead.` });
    else if (/\s/.test(ch) && ch !== " ") add({ kind: "character", severity: "problem", chars: [ch], message: "The only blank character an alphabet can hold is the ordinary space." });
    if (rows.length !== a.height || rows.some((r) => r.length !== a.width || /[^x.]/.test(r))) {
      add({ kind: "size", severity: "problem", chars: [ch], message: `${label(ch)} is not ${a.width} × ${a.height} cells of "x" and ".".` });
      continue;
    }
    good.push([ch, toCells(rows)]);
  }
  const space = a.symbols[" "];
  if (!space || space.some((r) => r.includes("x"))) add({ kind: "blank", severity: "problem", chars: [" "], message: "Space must be the blank symbol: it also fills the end of the last line." });

  for (const [ch, g] of good) {
    if (ch === " ") continue;
    const ones = g.flat().filter(Boolean).length;
    if (ones === 0) add({ kind: "blank", severity: "problem", chars: [ch], message: `${label(ch)} is blank, so it reads as a space.` });
    else if (ones === 1 || ones === cells) add({ kind: "faint", severity: "warning", chars: [ch], message: `${label(ch)} is ${ones === 1 ? "a single stitch" : "solid"}: easy to lose among the background${ones === cells ? " and it looks like a blank seen from the wrong side" : ""}.` });
  }

  let minDistance = Infinity;
  let turnDistance = Infinity;
  for (let i = 0; i < good.length; i++)
    for (let j = i + 1; j < good.length; j++) {
      const [ca, ga] = good[i]!;
      const [cb, gb] = good[j]!;
      const d = distance(ga, gb);
      minDistance = Math.min(minDistance, d);
      if (d === 0) add({ kind: "duplicate", severity: "problem", chars: [ca, cb], message: `${label(ca)} and ${label(cb)} are drawn the same, so nobody can tell them apart.` });
      else if (d === 1) add({ kind: "close", severity: "warning", chars: [ca, cb], message: `${label(ca)} and ${label(cb)} differ by one stitch: one slip turns one into the other without anyone noticing.` });
    }
  for (const [ca, ga] of good)
    ORIENTATIONS.slice(1).forEach((o, t) => {
      const turned = transform(ga, o);
      for (const [cb, gb] of good) {
        if (cb === ca) continue;
        const d = distance(turned, gb);
        turnDistance = Math.min(turnDistance, d);
        // Report each unordered pair once per turn.
        if (d === 0 && ca < cb) add({ kind: "turned", severity: "note", chars: [ca, cb], message: `${label(ca)} ${TURN_NAMES[t]} looks exactly like ${label(cb)}. A message could read differently the wrong way up; the decoder picks the reading that fits best.` });
      }
    });

  if (!Number.isFinite(minDistance)) minDistance = 0;
  if (!Number.isFinite(turnDistance)) turnDistance = 0;
  const slip =
    good.length < 2
      ? "Nothing to compare yet: draw a symbol."
      : minDistance <= 1
      ? "One slipped stitch can turn one symbol into another unnoticed."
      : minDistance === 2
        ? "One slipped stitch is always noticed, but it may be too close to call which symbol was meant."
        : turnDistance >= 3
          ? "One slipped stitch per symbol is noticed and repaired, whichever way the fabric is held."
          : "One slipped stitch per symbol is noticed and repaired when the fabric is read upright.";
  return { findings, minDistance, turnDistance, slip, usable: !findings.some((f) => f.severity === "problem") };
}

/** A usable alphabet as a pack for layout and reading, or an error naming the first problem. */
export function toPack(a: Alphabet): Pack {
  const c = checkAlphabet(a);
  const problem = c.findings.find((f) => f.severity === "problem");
  if (problem) throw new Error(`The alphabet "${a.name}" cannot be used yet: ${problem.message}`);
  return { name: a.name, width: a.width, height: a.height, glyphs: Object.fromEntries(Object.entries(a.symbols).map(([ch, rows]) => [ch, toCells(rows)])) };
}

// Suggestions work on symbols as bit masks, split in two halves so 36 cells fit JavaScript's 32-bit operators.
type Mask = [number, number];
const HALF = 18;
const pop = (n: number) => { let k = 0; for (; n; n &= n - 1) k++; return k; };
const dist = (a: Mask, b: Mask) => pop(a[0] ^ b[0]) + pop(a[1] ^ b[1]);
const toMask = (rows: readonly string[]): Mask => {
  const m: Mask = [0, 0];
  rows.join("").split("").forEach((ch, i) => { if (ch === "x") m[i < HALF ? 0 : 1] |= 1 << (i % HALF); });
  return m;
};
const fromMask = (m: Mask, w: number, h: number): string[] =>
  Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => { const i = r * w + c; return (m[i < HALF ? 0 : 1] >> (i % HALF)) & 1 ? "x" : "."; }).join(""));

/** Small seeded generator (mulberry32), so suggestions repeat for the same seed. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw symbols for the given characters, keeping whatever is already drawn. Each new symbol is the
 * candidate farthest from every other symbol, upright and turned, out of a few thousand tried.
 * About a third to two thirds of each symbol is purl, so none is faint or solid.
 */
export function suggestSymbols(a: Alphabet, chars: readonly string[], seed = 1): Alphabet {
  const { width: w, height: h } = a;
  const n = w * h;
  const turns = ORIENTATIONS.slice(1).map((o) => (m: Mask) => toMask(toRows(transform(toCells(fromMask(m, w, h)), o))));
  const next = random(seed);
  const tries = Array.from({ length: 1500 }, (): Mask => {
    const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => ".").join(""));
    const cells = rows.join("").split("");
    const want = Math.round(n * (0.35 + 0.3 * next()));
    for (let k = 0; k < want; ) { const i = Math.floor(next() * n); if (cells[i] === ".") (cells[i] = "x"), k++; }
    return toMask(Array.from({ length: h }, (_, r) => cells.slice(r * w, r * w + w).join("")));
  });
  const turnedTries = tries.map((m) => turns.map((t) => t(m)));
  const symbols: Record<string, string[]> = { ...a.symbols, " ": blankRows(w, h) };
  const placed: { m: Mask; turned: Mask[] }[] = Object.entries(symbols).filter(([ch]) => !chars.includes(ch) || ch === " ").map(([, rows]) => { const m = toMask(rows); return { m, turned: turns.map((t) => t(m)) }; });
  for (const ch of chars) {
    if (ch === " ") continue;
    let best = -1;
    let score = -1;
    tries.forEach((m, i) => {
      let s = Infinity;
      for (const p of placed) {
        s = Math.min(s, dist(m, p.m), ...p.turned.map((t) => dist(m, t)), ...turnedTries[i]!.map((t) => dist(t, p.m)));
        if (s <= score) return;
      }
      if (s > score) (score = s), (best = i);
    });
    const m = tries[best]!;
    symbols[ch] = fromMask(m, w, h);
    placed.push({ m, turned: turnedTries[best]! });
  }
  return { ...a, symbols };
}

/** The alphabet as a file. */
export const exportAlphabet = (a: Alphabet): string => JSON.stringify(a, null, 2);

/** Read an alphabet file, or say why it cannot be read. Checking what is drawn is checkAlphabet's job. */
export function importAlphabet(json: string): Alphabet | string {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return "This is not an alphabet file: it is not valid JSON.";
  }
  const d = data as Partial<Alphabet>;
  if (!d || typeof d !== "object" || d.format !== ALPHABET_FORMAT) return `This is not an alphabet file: its format is not "${ALPHABET_FORMAT}".`;
  if (d.version !== ALPHABET_VERSION) return `This alphabet file is version ${String(d.version)}; this lab reads version ${ALPHABET_VERSION}.`;
  if (typeof d.name !== "string") return "The alphabet file has no name.";
  if (!Number.isInteger(d.width) || !Number.isInteger(d.height)) return "The alphabet file needs a whole-number width and height.";
  if (!d.symbols || typeof d.symbols !== "object") return "The alphabet file has no symbols.";
  for (const [ch, rows] of Object.entries(d.symbols)) if (!Array.isArray(rows) || rows.some((r) => typeof r !== "string")) return `The symbol for ${label(ch)} should be a list of rows like "x..x".`;
  return { format: ALPHABET_FORMAT, version: ALPHABET_VERSION, name: d.name, width: d.width!, height: d.height!, symbols: d.symbols };
}

const INK = "#16140f";
const PAPER = "#f3eee2";
const RULE = "#cfc6b1";
const FONT = "'IBM Plex Mono', ui-monospace, Consolas, monospace";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A printable legend: every symbol drawn with its character, in a grid, colours fixed for print. */
export function legendSvg(a: Alphabet, perRow = 8): string {
  const cell = 10;
  const entries = Object.entries(a.symbols).sort(([x], [y]) => (x === " " ? 1 : y === " " ? -1 : x.localeCompare(y)));
  const tileW = Math.max(a.width * cell, 40) + 16;
  const tileH = a.height * cell + 30;
  const cols = Math.min(perRow, entries.length);
  const width = cols * tileW + 16;
  const height = Math.ceil(entries.length / perRow) * tileH + 52;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">`,
    `<title>${esc(a.name)}: alphabet legend</title>`,
    `<rect width="${width}" height="${height}" fill="${PAPER}"/>`,
    `<text x="8" y="22" font-size="14" font-weight="600" fill="${INK}">${esc(a.name)}</text>`,
    `<text x="8" y="38" font-size="10" fill="${INK}">${a.width} × ${a.height} stitches. Filled = purl or colour B. Designed by its maker; not traditional.</text>`,
  ];
  entries.forEach(([ch, rows], i) => {
    const x0 = 8 + (i % perRow) * tileW + (tileW - a.width * cell) / 2 - 4;
    const y0 = 50 + Math.floor(i / perRow) * tileH;
    rows.forEach((row, r) =>
      [...row].forEach((v, c) => parts.push(`<rect x="${x0 + c * cell}" y="${y0 + r * cell}" width="${cell}" height="${cell}" fill="${v === "x" ? INK : PAPER}" stroke="${RULE}" stroke-width="0.6"/>`)),
    );
    parts.push(`<text x="${x0 + (a.width * cell) / 2}" y="${y0 + a.height * cell + 16}" font-size="12" text-anchor="middle" fill="${INK}">${esc(ch === " " ? "space" : ch)}</text>`);
  });
  parts.push("</svg>");
  return parts.join("");
}

// Share code: the whole alphabet as one line to paste into a message. Bytes are
// name, size, characters and drawings packed a bit per cell, written in Crockford
// base 32 (no I, L, O or U, so nothing looks like a digit) in groups of five,
// after "UTPA1" and before a two-character check.
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_HEAD = "UTPA1";

const codeCheck = (body: string): string => {
  let a = 1, b = 0;
  for (const ch of body) (a = (a + B32.indexOf(ch) + 1) % 1021), (b = (b + a) % 1021);
  const n = (a * 7 + b) % 1024;
  return B32[n >> 5]! + B32[n & 31]!;
};

export function alphabetCode(a: Alphabet): string {
  const enc = new TextEncoder();
  const chars = Object.keys(a.symbols).filter((ch) => ch !== " ").sort();
  const name = enc.encode(a.name.slice(0, 40));
  const charBytes = enc.encode(chars.join(""));
  const bits: number[] = [];
  for (const ch of chars) for (const row of a.symbols[ch]!) for (const v of row) bits.push(v === "x" ? 1 : 0);
  const bytes = [name.length, ...name, (a.width << 4) | a.height, charBytes.length, ...charBytes];
  for (let i = 0; i < bits.length; i += 8) bytes.push(bits.slice(i, i + 8).reduce((t, b, k) => t | (b << (7 - k)), 0));
  let body = "";
  let acc = 0, n = 0;
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    n += 8;
    while (n >= 5) (body += B32[(acc >> (n - 5)) & 31]), (n -= 5);
  }
  if (n) body += B32[(acc << (5 - n)) & 31];
  const full = body + codeCheck(body);
  return [CODE_HEAD, ...(full.match(/.{1,5}/g) ?? [])].join("-");
}

/** Read a share code back, or say why not. Spaces, dashes and letter case do not matter; O is read as 0, I and L as 1. */
export function parseAlphabetCode(code: string): Alphabet | string {
  const clean = code.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (!clean.startsWith(CODE_HEAD.replace(/O/g, "0").replace(/[IL]/g, "1"))) return `An alphabet code starts with ${CODE_HEAD}.`;
  const payload = clean.slice(CODE_HEAD.length);
  const bad = [...payload].findIndex((ch) => !B32.includes(ch));
  if (bad >= 0) return `"${payload[bad]}" (character ${bad + 1} after ${CODE_HEAD}) is not used in alphabet codes; possible typing error there.`;
  const body = payload.slice(0, -2);
  if (payload.length < 4 || codeCheck(body) !== payload.slice(-2)) return "The last two characters do not match the rest: a character may have been mistyped, left out or added.";
  const bytes: number[] = [];
  let acc = 0, n = 0;
  for (const ch of body) {
    acc = ((acc << 5) | B32.indexOf(ch)) & 0xffff;
    n += 5;
    if (n >= 8) (bytes.push((acc >> (n - 8)) & 255), (n -= 8));
  }
  try {
    const dec = new TextDecoder("utf-8", { fatal: true });
    let i = 0;
    const take = (k: number) => { if (i + k > bytes.length) throw new Error("short"); const out = bytes.slice(i, i + k); i += k; return out; };
    const name = dec.decode(new Uint8Array(take(take(1)[0]!)));
    const size = take(1)[0]!;
    const chars = [...dec.decode(new Uint8Array(take(take(1)[0]!)))];
    const width = size >> 4, height = size & 15;
    const bitsNeeded = chars.length * width * height;
    const cells = take(Math.ceil(bitsNeeded / 8)).flatMap((b) => [7, 6, 5, 4, 3, 2, 1, 0].map((k) => (b >> k) & 1));
    const symbols: Record<string, string[]> = { " ": blankRows(width, height) };
    chars.forEach((ch, c) => {
      symbols[ch] = Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, x) => (cells[(c * height + r) * width + x] ? "x" : ".")).join(""));
    });
    return { format: ALPHABET_FORMAT, version: ALPHABET_VERSION, name, width, height, symbols };
  } catch {
    return "The code is too short for what it says it holds: part of it may be missing.";
  }
}
