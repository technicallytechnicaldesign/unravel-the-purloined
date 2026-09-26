// Motif mutation (packet section 27.12, task S4): every cell of a message grid
// becomes a small decorative motif, in one of two versions that differ in a
// single detail, "centre empty" for 0 and "centre filled" for 1. The fabric
// reads as a pattern with small irregularities; a reader who knows the motif
// reads bits.
//
// The motifs are designed here for this project; they are not traditional
// patterns. Each is symmetric under turning and mirroring, so a piece read
// upside down or from the other side still gives the same motif, and the
// grid's own marker row settles which way is up.

import { type Bit } from "./fivebit";
import { type Cell } from "./grid";

export type MotifId = "window" | "diamond" | "cross";

export interface Motif {
  id: MotifId;
  name: string;
  /** Tile size in stitches (square, odd). */
  size: number;
  zero: Bit[][];
  one: Bit[][];
  /** How to read it by eye, for key cards and hints. */
  reading: string;
}

// Rows written top first as they look; "x" is purl (or colour B), "." knit (or colour A).
const tile = (...rows: string[]): Bit[][] => rows.map((r) => [...r].map((ch) => (ch === "x" ? 1 : 0))).reverse();

export const MOTIFS: Record<MotifId, Motif> = {
  window: {
    id: "window",
    name: "Windows (3 × 3, designed here)",
    size: 3,
    zero: tile("xxx", "x.x", "xxx"),
    one: tile("xxx", "xxx", "xxx"),
    reading: "Each 3 by 3 square is one cell: an open window (a knit stitch in the middle) is 0, a filled square is 1.",
  },
  diamond: {
    id: "diamond",
    name: "Diamonds (5 × 5, designed here)",
    size: 5,
    zero: tile("..x..", ".x.x.", "x...x", ".x.x.", "..x.."),
    one: tile("..x..", ".x.x.", "x.x.x", ".x.x.", "..x.."),
    reading: "Each diamond is one cell: an empty centre is 0, a dot in the centre is 1.",
  },
  cross: {
    id: "cross",
    name: "Crosses (5 × 5, designed here)",
    size: 5,
    zero: tile("..x..", "..x..", "xx.xx", "..x..", "..x.."),
    one: tile("..x..", "..x..", "xxxxx", "..x..", "..x.."),
    reading: "Each cross is one cell: a gap where the arms meet is 0, a solid centre is 1.",
  },
};

/** Cells that differ between the two versions: the ones that carry the bit. */
export const carrying = (m: Motif): Cell[] =>
  m.zero.flatMap((row, r) => row.flatMap((b, c) => (b !== m.one[r]![c] ? [[r, c] as Cell] : [])));

/** Grid cells to fabric: each cell becomes one motif tile. Roles mark the carrying stitches. */
export function expand(grid: readonly (readonly Bit[])[], m: Motif): { cells: Bit[][]; carries: boolean[][] } {
  const s = m.size;
  const carry = new Set(carrying(m).map(([r, c]) => `${r},${c}`));
  const rows = grid.length * s;
  const cols = (grid[0]?.length ?? 0) * s;
  const cells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (grid[Math.floor(r / s)]![Math.floor(c / s)] ? m.one : m.zero)[r % s]![c % s]!));
  const carries = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => carry.has(`${r % s},${c % s}`)));
  return { cells, carries };
}

export interface TileNote {
  /** Grid cell (tile) the note is about. */
  cell: Cell;
  /** Stitches that match neither version exactly. */
  off: number;
  message: string;
}

/**
 * Fabric back to grid cells, one per tile, by the nearest version. The wrong
 * side of knit and purl shows every stitch inverted, so inverted versions
 * count too. Tiles that match neither exactly are reported, not hidden.
 */
export function reduce(fabric: readonly (readonly Bit[])[], m: Motif): { grid: Bit[][]; notes: TileNote[]; fits: boolean } {
  const s = m.size;
  const rows = Math.floor(fabric.length / s);
  const cols = Math.floor((fabric[0]?.length ?? 0) / s);
  const fits = rows * s === fabric.length && cols * s === (fabric[0]?.length ?? 0);
  const notes: TileNote[] = [];
  const grid = Array.from({ length: rows }, (_, tr) =>
    Array.from({ length: cols }, (_, tc) => {
      const dist = (v: Bit[][], inv: boolean) => v.reduce((n, row, r) => n + row.reduce<number>((k, b, c) => k + (fabric[tr * s + r]![tc * s + c] !== (inv ? 1 - b : b) ? 1 : 0), 0), 0);
      const d0 = Math.min(dist(m.zero, false), dist(m.zero, true));
      const d1 = Math.min(dist(m.one, false), dist(m.one, true));
      const bit: Bit = d1 < d0 ? 1 : 0;
      const off = Math.min(d0, d1);
      if (off > 0 || d0 === d1) {
        notes.push({
          cell: [tr, tc],
          off,
          message: d0 === d1 ? `A tile matches both versions equally (${off} stitches off); read as 0.` : `A tile is ${off} stitch${off === 1 ? "" : "es"} off its motif; read as ${bit}.`,
        });
      }
      return bit;
    }),
  );
  return { grid, notes, fits };
}
