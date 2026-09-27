// Motif alphabet (packet 27.11, Phase 4): each character becomes a small
// picture, laid out like text: left to right, top line first. Two packs, both
// designed here for this project and not traditional:
//
//   pixel5      5 x 5 letters anyone can read
//   geometric3  3 x 3 symbols, a secret alphabet: every pair differs by at
//               least two stitches, so one slipped stitch is always noticed
//               and reported, though it may be too close to call
//   geometric4  4 x 4 symbols: every pair differs by at least three stitches,
//               also after any turn or inversion of the fabric, so one
//               slipped stitch per symbol is repaired and reported
//
// Carries A to Z, 0 to 9, space, full stop and question mark.

import { type Bit } from "./fivebit";
import { transform, type Cell, type Orientation } from "./grid";

export type GlyphPack = "pixel5" | "geometric3" | "geometric4";

export const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .?";

// Rows top first as they look; "x" is purl (or colour B).
const PIXEL5: Record<string, string> = {
  A: ".xxx. x...x xxxxx x...x x...x", B: "xxxx. x...x xxxx. x...x xxxx.", C: ".xxxx x.... x.... x.... .xxxx",
  D: "xxxx. x...x x...x x...x xxxx.", E: "xxxxx x.... xxxx. x.... xxxxx", F: "xxxxx x.... xxxx. x.... x....",
  G: ".xxxx x.... x.xxx x...x .xxxx", H: "x...x x...x xxxxx x...x x...x", I: "xxxxx ..x.. ..x.. ..x.. xxxxx",
  J: "..xxx ...x. ...x. x..x. .xx..", K: "x...x x..x. xxx.. x..x. x...x", L: "x.... x.... x.... x.... xxxxx",
  M: "x...x xx.xx x.x.x x...x x...x", N: "x...x xx..x x.x.x x..xx x...x", O: ".xxx. x...x x...x x...x .xxx.",
  P: "xxxx. x...x xxxx. x.... x....", Q: ".xxx. x...x x.x.x x..x. .xx.x", R: "xxxx. x...x xxxx. x..x. x...x",
  S: ".xxxx x.... .xxx. ....x xxxx.", T: "xxxxx ..x.. ..x.. ..x.. ..x..", U: "x...x x...x x...x x...x .xxx.",
  V: "x...x x...x x...x .x.x. ..x..", W: "x...x x...x x.x.x xx.xx x...x", X: "x...x .x.x. ..x.. .x.x. x...x",
  Y: "x...x .x.x. ..x.. ..x.. ..x..", Z: "xxxxx ...x. ..x.. .x... xxxxx",
  "0": ".xxx. x..xx x.x.x xx..x .xxx.", "1": "..x.. .xx.. ..x.. ..x.. .xxx.", "2": ".xxx. x...x ..xx. .x... xxxxx",
  "3": "xxxx. ....x .xxx. ....x xxxx.", "4": "x..x. x..x. xxxxx ...x. ...x.", "5": "xxxxx x.... xxxx. ....x xxxx.",
  "6": ".xxx. x.... xxxx. x...x .xxx.", "7": "xxxxx ....x ...x. ..x.. ..x..", "8": ".xxx. x...x .xxx. x...x .xxx.",
  "9": ".xxx. x...x .xxxx ....x .xxx.", " ": "..... ..... ..... ..... .....", ".": "..... ..... ..... ..... ..x..",
  "?": ".xxx. x...x ..xx. ..... ..x..",
};

const toBits = (rows: string): Bit[][] => rows.split(" ").map((r) => [...r].map((ch) => (ch === "x" ? 1 : 0) as Bit)).reverse();
const distance = (a: Bit[][], b: Bit[][]): number => a.reduce((n, row, r) => n + row.reduce<number>((k, x, c) => k + (x === b[r]![c] ? 0 : 1), 0), 0);

/** 3 x 3 symbols chosen in a fixed order so that any two differ by two stitches or more. Space stays empty. */
function geometric(): Record<string, Bit[][]> {
  const out: Record<string, Bit[][]> = { " ": toBits("... ... ...") };
  const picked: Bit[][][] = [out[" "]!];
  const candidates = Array.from({ length: 512 }, (_, n) => n)
    .filter((n) => { const ones = n.toString(2).split("").filter((d) => d === "1").length; return ones >= 3 && ones <= 6; })
    .sort((a, b) => ((a * 2654435761) >>> 0) - ((b * 2654435761) >>> 0));
  for (const ch of CHARSET.replace(" ", "")) {
    for (const n of candidates) {
      const g = Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => ((n >> (r * 3 + c)) & 1) as Bit));
      if (picked.every((p) => distance(p, g) >= 2)) {
        out[ch] = g;
        picked.push(g);
        break;
      }
    }
  }
  return out;
}

/** 16 cells as a number, bit r * 4 + c; and back to rows. */
const mask4 = (n: number): Bit[][] => Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => ((n >> (r * 4 + c)) & 1) as Bit));
const ones = (n: number): number => { let k = 0; for (; n; n &= n - 1) k++; return k; };

/**
 * 4 x 4 symbols, picked in a fixed order. Any two differ by three stitches or more, and a
 * symbol seen upside down, mirrored or inverted is still three or more from every other
 * symbol, so one slip reads back as the right symbol whichever way the fabric is held.
 * Each symbol has 5 to 11 purls so none is nearly blank or nearly solid. Space stays empty.
 */
function geometric4(): Record<string, Bit[][]> {
  const flip = (n: number, f: (r: number, c: number) => [number, number]) => {
    let o = 0;
    for (let i = 0; i < 16; i++) if ((n >> i) & 1) { const [r, c] = f(i >> 2, i & 3); o |= 1 << (r * 4 + c); }
    return o;
  };
  const turn = (n: number) => flip(n, (r, c) => [3 - r, 3 - c]);
  const mirror = (n: number) => flip(n, (r, c) => [r, 3 - c]);
  const turns = [false, true].flatMap((t) => [false, true].flatMap((m) => [false, true].map((i) => (n: number) => {
    if (t) n = turn(n);
    if (m) n = mirror(n);
    return i ? n ^ 0xffff : n;
  }))).slice(1); // every turn but upright
  const far = (a: number, b: number) => ones(a ^ b) >= 3;
  const picked = [0];
  const candidates = Array.from({ length: 65536 }, (_, n) => n)
    .filter((n) => ones(n) >= 5 && ones(n) <= 11)
    .sort((a, b) => (Math.imul(a, 2654435761) >>> 0) - (Math.imul(b, 2654435761) >>> 0));
  for (const n of candidates) {
    if (picked.length === CHARSET.length) break;
    if (picked.every((p) => far(p, n) && turns.every((t) => far(t(n), p) && far(t(p), n)))) picked.push(n);
  }
  return Object.fromEntries([" ", ...CHARSET.replace(" ", "")].map((ch, i) => [ch, mask4(picked[i]!)]));
}

export const PACKS: Record<GlyphPack, { name: string; size: number; glyphs: Record<string, Bit[][]> }> = {
  pixel5: { name: "Pixel letters (5 × 5, designed here)", size: 5, glyphs: Object.fromEntries(Object.entries(PIXEL5).map(([k, v]) => [k, toBits(v)])) },
  geometric3: { name: "Geometric secret alphabet (3 × 3, designed here)", size: 3, glyphs: geometric() },
  geometric4: { name: "Geometric secret alphabet that repairs a slip (4 × 4, designed here)", size: 4, glyphs: geometric4() },
};

/** Characters per line for a width in stitches: each glyph plus one stitch of space. */
export const perLine = (width: number, size: number): number => Math.max(1, Math.floor((width + 1) / (size + 1)));

/** Lay text out as glyphs. Returns cells (row 0 at the bottom) and which cells belong to a glyph. */
export function layoutGlyphs(text: string, pack: GlyphPack, width: number): { cells: Bit[][]; inGlyph: boolean[][] } {
  const { size, glyphs } = PACKS[pack];
  if (width < size) throw new Error(`The motif alphabet needs at least ${size} stitches across.`);
  const n = perLine(width, size);
  const lines: string[] = [];
  for (let i = 0; i < Math.max(text.length, 1); i += n) lines.push(text.slice(i, i + n));
  const height = lines.length * size + (lines.length - 1);
  const cells = Array.from({ length: height }, () => new Array<Bit>(width).fill(0));
  const inGlyph = Array.from({ length: height }, () => new Array<boolean>(width).fill(false));
  lines.forEach((line, li) => {
    const top = height - 1 - li * (size + 1); // first line at the top
    [...line].forEach((ch, k) => {
      const g = glyphs[ch];
      if (!g) throw new Error(`"${ch}" has no motif in this alphabet.`);
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++) {
          const row = top - (size - 1) + r;
          cells[row]![k * (size + 1) + c] = g[r]![c]!;
          inGlyph[row]![k * (size + 1) + c] = true;
        }
    });
  });
  return { cells, inGlyph };
}

export interface GlyphNote {
  cells: Cell[];
  message: string;
}

const ORIENTATIONS: Orientation[] = [false, true].flatMap((rotated180) => [false, true].flatMap((mirrored) => [false, true].map((inverted) => ({ rotated180, mirrored, inverted }))));

/** Read glyphs back, trying every turn of the fabric and keeping the one that matches best. */
export function readGlyphs(cells: readonly (readonly Bit[])[], pack: GlyphPack): { text: string; orientation: Orientation; notes: GlyphNote[] } {
  const { size, glyphs } = PACKS[pack];
  const entries = Object.entries(glyphs);
  const read = (grid: Bit[][]) => {
    const height = grid.length;
    const width = grid[0]?.length ?? 0;
    const lines = Math.floor((height + 1) / (size + 1));
    const n = perLine(width, size);
    let text = "";
    let total = 0;
    const notes: GlyphNote[] = [];
    for (let li = 0; li < lines; li++) {
      const top = height - 1 - li * (size + 1);
      for (let k = 0; k < n; k++) {
        const block = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => grid[top - (size - 1) + r]![k * (size + 1) + c]!));
        const scored = entries.map(([ch, g]) => ({ ch, d: distance(block, g) })).sort((a, b) => a.d - b.d);
        const best = scored[0]!;
        const ties = scored.filter((s) => s.d === best.d).map((s) => `"${s.ch}"`);
        total += best.d;
        text += best.ch;
        if (best.d > 0)
          notes.push({
            cells: [[top - (size - 1), k * (size + 1)]],
            message: `Character ${text.length} is ${best.d} stitch${best.d === 1 ? "" : "es"} off ${ties.length > 1 ? `${ties.join(" and ")}, too close to call` : `"${best.ch}"`}; read as "${best.ch}".`,
          });
      }
    }
    return { text: text.replace(/\s+$/, ""), total, notes };
  };
  const tries = ORIENTATIONS.map((o) => ({ o, ...read(transform(cells, o)) }));
  const best = tries.reduce((a, t) => (t.total < a.total ? t : a));
  return { text: best.text, orientation: best.o, notes: best.notes };
}
