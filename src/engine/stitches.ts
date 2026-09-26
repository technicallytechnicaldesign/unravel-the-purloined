// Stitch patterns for borders and plain sections (tasks T14, T15). Each is
// described by what the right side shows, cell by cell; the construction
// translator turns that into needle actions, so flat and round come out right.
//
// Names differ between the US and the UK; both are given.

import { type Visible } from "./construction";
import { family, type CarrierId } from "./carrier";

export type StitchPattern =
  | "stockinette"
  | "garter"
  | "seed"
  | "double-seed"
  | "rib1"
  | "rib2"
  | "solid-a"
  | "solid-b"
  | "checker"
  | "stripes";

export interface PatternInfo {
  name: string;
  /** Which carrier's states it uses. */
  carrier: CarrierId;
  /** Columns in one repeat; a round border reads best when the stitch count is a multiple. */
  repeat: number;
  /** Visible state at chart row r (0 = bottom), column c (0 = left). */
  cell(r: number, c: number): Visible;
}

const odd = (n: number) => ((n % 2) + 2) % 2 === 1;

export const PATTERNS: Record<StitchPattern, PatternInfo> = {
  stockinette: { name: "Stockinette (UK: stocking stitch)", carrier: "purl-relief", repeat: 1, cell: () => "knit" },
  garter: { name: "Garter stitch", carrier: "purl-relief", repeat: 1, cell: (r) => (odd(r) ? "purl" : "knit") },
  seed: { name: "Seed stitch (UK: moss stitch)", carrier: "purl-relief", repeat: 2, cell: (r, c) => (odd(r + c) ? "purl" : "knit") },
  "double-seed": { name: "Double seed (US: moss stitch; UK: double moss)", carrier: "purl-relief", repeat: 2, cell: (r, c) => (odd(Math.floor(r / 2) + c) ? "purl" : "knit") },
  rib1: { name: "1 × 1 rib", carrier: "purl-relief", repeat: 2, cell: (_, c) => (odd(c) ? "purl" : "knit") },
  rib2: { name: "2 × 2 rib", carrier: "purl-relief", repeat: 4, cell: (_, c) => (odd(Math.floor(c / 2)) ? "purl" : "knit") },
  "solid-a": { name: "Solid colour A", carrier: "two-colour", repeat: 1, cell: () => "A" },
  "solid-b": { name: "Solid colour B", carrier: "two-colour", repeat: 1, cell: () => "B" },
  checker: { name: "Checkerboard, A and B", carrier: "two-colour", repeat: 2, cell: (r, c) => (odd(r + c) ? "B" : "A") },
  stripes: { name: "Two-row stripes, A and B", carrier: "two-colour", repeat: 1, cell: (r) => (odd(Math.floor(r / 2)) ? "B" : "A") },
};

export const patternsFor = (carrier: CarrierId): StitchPattern[] =>
  (Object.keys(PATTERNS) as StitchPattern[]).filter((p) => PATTERNS[p].carrier === family(carrier));

/** Restyle the border cells of a chart with a pattern. Other cells are untouched. */
export function applyBorder(chart: readonly (readonly Visible[])[], isBorder: (r: number, c: number) => boolean, pattern: StitchPattern): Visible[][] {
  const p = PATTERNS[pattern];
  return chart.map((row, r) => row.map((v, c) => (isBorder(r, c) ? p.cell(r, c) : v)));
}

/** A plain block of rows in one pattern, for the sections above and below a chart. */
export function section(rows: number, stitches: number, pattern: StitchPattern, rowOffset = 0): Visible[][] {
  const p = PATTERNS[pattern];
  return Array.from({ length: rows }, (_, r) => Array.from({ length: stitches }, (_, c) => p.cell(r + rowOffset, c)));
}
