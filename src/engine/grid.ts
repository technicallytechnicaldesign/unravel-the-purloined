// Logical grid (packet sections 24.2, 31, 37): pour a bit stream into rows and
// add what a decoder needs to find the right way up. Still logical cells, not
// stitches; a carrier and the construction translator come later.
//
// Coordinates follow knitting charts: cells[row][col], row 0 is the bottom
// (chart row 1, knitted first), col 0 is the left edge as seen on the right side.
//
// Layout, bottom to top:
//   marker row   1 1 0 1 0 0 ...  asymmetric, so turned or mirrored fabric is spotted
//   data rows    message cells in chart reading order (right to left, bottom up),
//                then one 1 and 0s to fill the last row
//   top row      all 1
// With `border`, a ring of 0 cells goes round the lot.

import { type Bit } from "./fivebit";

export interface GridOptions {
  /** Cells per row for the message, not counting the border. At least 3. */
  width: number;
  border: boolean;
}

export type CellRole = "data" | "pad" | "marker" | "top" | "border";

export interface LogicalGrid {
  options: GridOptions;
  /** cells[row][col]; row 0 is the bottom, col 0 the left. */
  cells: Bit[][];
  roles: CellRole[][];
}

export const MIN_WIDTH = 3;

/** The orientation marker for a given width: 1 1 0 1 then 0s. */
export function markerRow(width: number): Bit[] {
  return Array.from({ length: width }, (_, i) => (i === 0 || i === 1 || i === 3 ? 1 : 0));
}

/** Lay a bit stream out as a grid with marker, padding, top row and optional border. */
export function layout(bits: readonly Bit[], options: GridOptions): LogicalGrid {
  const { width, border } = options;
  if (!Number.isInteger(width) || width < MIN_WIDTH) throw new Error(`Grid width must be a whole number of at least ${MIN_WIDTH}.`);

  // Padding: one 1 then 0s, so the decoder can strip it without knowing the length.
  const padded: Bit[] = [...bits, 1];
  while (padded.length % width !== 0) padded.push(0);

  const rows: { cells: Bit[]; roles: CellRole[] }[] = [];
  rows.push({ cells: markerRow(width), roles: new Array<CellRole>(width).fill("marker") });
  for (let r = 0; r < padded.length / width; r++) {
    const cells = new Array<Bit>(width);
    const roles = new Array<CellRole>(width);
    for (let k = 0; k < width; k++) {
      const i = r * width + k;
      const col = width - 1 - k; // right to left
      cells[col] = padded[i]!;
      roles[col] = i < bits.length ? "data" : "pad";
    }
    rows.push({ cells, roles });
  }
  rows.push({ cells: new Array<Bit>(width).fill(1), roles: new Array<CellRole>(width).fill("top") });

  if (!border) return { options, cells: rows.map((r) => r.cells), roles: rows.map((r) => r.roles) };
  const full = width + 2;
  const edge = () => ({ cells: new Array<Bit>(full).fill(0), roles: new Array<CellRole>(full).fill("border") });
  const framed = [edge(), ...rows.map((r) => ({ cells: [0 as Bit, ...r.cells, 0 as Bit], roles: ["border" as CellRole, ...r.roles, "border" as CellRole] })), edge()];
  return { options, cells: framed.map((r) => r.cells), roles: framed.map((r) => r.roles) };
}

/** How a grid was turned relative to how it was made. Each part undoes itself. */
export interface Orientation {
  rotated180: boolean;
  mirrored: boolean;
  /** Every cell flipped: what the wrong side of knit/purl shows. */
  inverted: boolean;
}

export const UPRIGHT: Orientation = { rotated180: false, mirrored: false, inverted: false };

export function transform(cells: readonly (readonly Bit[])[], o: Orientation): Bit[][] {
  let out = cells.map((row) => [...row]);
  if (o.rotated180) out = out.reverse().map((row) => row.reverse());
  if (o.mirrored) out = out.map((row) => row.reverse());
  if (o.inverted) out = out.map((row) => row.map((b) => (1 - b) as Bit));
  return out;
}

export function describe(o: Orientation): string {
  const turn = o.rotated180 ? (o.mirrored ? "flipped top to bottom" : "upside down") : o.mirrored ? "mirrored left to right" : "upright";
  return o.inverted ? `${turn}, with every cell inverted (as the wrong side of knit/purl shows)` : turn;
}

export interface GridIssue {
  kind: "orientation" | "marker" | "ambiguous-orientation" | "padding" | "shape";
  message: string;
}

export interface GridReadResult {
  bits: Bit[];
  orientation: Orientation;
  issues: GridIssue[];
}

const ORIENTATIONS: Orientation[] = [false, true].flatMap((rotated180) =>
  [false, true].flatMap((mirrored) => [false, true].map((inverted) => ({ rotated180, mirrored, inverted }))),
);

/** Score how well an upright-candidate grid matches the fixed marker, top row and border. */
function fit(cells: Bit[][], border: boolean): { score: number; max: number } {
  const b = border ? 1 : 0;
  const width = cells[0]!.length - 2 * b;
  const rows = cells.length;
  let score = 0;
  let max = 0;
  const check = (got: Bit | undefined, want: Bit) => {
    max++;
    if (got === want) score++;
  };
  markerRow(width).forEach((want, i) => check(cells[b]![b + i], want));
  for (let i = 0; i < width; i++) check(cells[rows - 1 - b]![b + i], 1);
  if (border) {
    cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (r === 0 || r === rows - 1 || c === 0 || c === row.length - 1) check(cell, 0);
      }),
    );
  }
  return { score, max };
}

/**
 * Read a grid back to its bit stream. Tries every way the fabric could have
 * been turned, keeps the one that best matches the marker, top row and border,
 * and reports anything off rather than guessing silently.
 */
export function readGrid(cells: readonly (readonly Bit[])[], border: boolean): GridReadResult {
  const issues: GridIssue[] = [];
  const b = border ? 1 : 0;
  const width = (cells[0]?.length ?? 0) - 2 * b;
  if (width < MIN_WIDTH || cells.length < 2 + 2 * b || cells.some((row) => row.length !== cells[0]!.length)) {
    return { bits: [], orientation: UPRIGHT, issues: [{ kind: "shape", message: "Grid is too small or its rows differ in length." }] };
  }

  const scored = ORIENTATIONS.map((o) => ({ o, grid: transform(cells, o), ...fit(transform(cells, o), border) }));
  const best = scored.reduce((a, c) => (c.score > a.score ? c : a));
  const ties = scored.filter((s) => s.score === best.score);
  const { o, grid, score, max } = best;

  if (ties.length > 1) {
    issues.push({ kind: "ambiguous-orientation", message: `Marker fits ${ties.length} orientations equally well; read as ${describe(o)}.` });
  } else if (o !== ORIENTATIONS[0]) {
    issues.push({ kind: "orientation", message: `Grid was ${describe(o)}; read the right way round.` });
  }
  if (score < max) issues.push({ kind: "marker", message: `${max - score} of ${max} marker, top and border cells do not match.` });

  // Data rows sit between marker and top, read right to left, bottom up.
  const bits: Bit[] = [];
  for (let r = b + 1; r < grid.length - 1 - b; r++) for (let c = b + width - 1; c >= b; c--) bits.push(grid[r]![c]!);
  const lastOne = bits.lastIndexOf(1);
  if (lastOne < 0 || bits.length - lastOne > width) {
    issues.push({ kind: "padding", message: "End-of-message padding (a 1 then 0s in the last row) was not found; all data cells returned." });
    return { bits, orientation: o, issues };
  }
  return { bits: bits.slice(0, lastOne), orientation: o, issues };
}
