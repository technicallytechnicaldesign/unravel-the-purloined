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
// With `border`, a frame `borderWidth` cells deep (default 1) goes round the
// lot. Its cells are 0 in the logical grid; a border style may restyle them
// later, so the decoder never relies on what the border holds, only its depth.

import { type Bit } from "./fivebit";

export interface GridOptions {
  /** Cells per row for the message, not counting the border. At least 3. */
  width: number;
  border: boolean;
  /** Border depth in cells on every side, when `border` is on. Default 1. */
  borderWidth?: number;
}

/** A border given as on/off (depth 1) or as a depth in cells. */
export type Edge = boolean | number;
export const edgeDepth = (e: Edge): number => (e === true ? 1 : e === false ? 0 : Math.max(0, Math.floor(e)));
/** The border depth a layout uses. */
export const borderOf = (o: GridOptions): number => (o.border ? (o.borderWidth ?? 1) : 0);

export type CellRole = "data" | "pad" | "marker" | "top" | "border" | "filler";

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

  const f = frame(rows.map((r) => r.cells), rows.map((r) => r.roles), border ? borderOf(options) : 0);
  return { options, ...f };
}

/** Put a border `depth` cells deep round a block of cells. Border cells are 0 with the role "border". */
export function frame(cells: readonly (readonly Bit[])[], roles: readonly (readonly CellRole[])[], depth: number): { cells: Bit[][]; roles: CellRole[][] } {
  if (depth <= 0) return { cells: cells.map((r) => [...r]), roles: roles.map((r) => [...r]) };
  const full = (cells[0]?.length ?? 0) + 2 * depth;
  const side = <T>(v: T) => new Array<T>(depth).fill(v);
  const edgeCells = () => new Array<Bit>(full).fill(0);
  const edgeRoles = () => new Array<CellRole>(full).fill("border");
  return {
    cells: [...Array.from({ length: depth }, edgeCells), ...cells.map((r) => [...side<Bit>(0), ...r, ...side<Bit>(0)]), ...Array.from({ length: depth }, edgeCells)],
    roles: [...Array.from({ length: depth }, edgeRoles), ...roles.map((r) => [...side<CellRole>("border"), ...r, ...side<CellRole>("border")]), ...Array.from({ length: depth }, edgeRoles)],
  };
}

/** The block inside a border `depth` cells deep. */
export function unframe<T>(cells: readonly (readonly T[])[], depth: number): T[][] {
  return cells.slice(depth, cells.length - depth || undefined).map((r) => r.slice(depth, r.length - depth || undefined));
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
  /** Cells concerned, in upright coordinates (as read, after undoing any turn). */
  cells?: Cell[];
}

export interface GridReadResult {
  bits: Bit[];
  orientation: Orientation;
  issues: GridIssue[];
}

const ORIENTATIONS: Orientation[] = [false, true].flatMap((rotated180) =>
  [false, true].flatMap((mirrored) => [false, true].map((inverted) => ({ rotated180, mirrored, inverted }))),
);

/** Score how well an upright-candidate grid matches the fixed marker and top row. Border cells are not checked: styles may fill them. */
function fit(cells: Bit[][], b: number): { score: number; max: number; wrong: Cell[] } {
  const width = cells[0]!.length - 2 * b;
  const rows = cells.length;
  let score = 0;
  let max = 0;
  const wrong: Cell[] = [];
  const check = (r: number, c: number, want: Bit) => {
    max++;
    if (cells[r]![c] === want) score++;
    else wrong.push([r, c]);
  };
  markerRow(width).forEach((want, i) => check(b, b + i, want));
  for (let i = 0; i < width; i++) check(rows - 1 - b, b + i, 1);
  return { score, max, wrong };
}

/**
 * Read a grid back to its bit stream. Tries every way the fabric could have
 * been turned, keeps the one that best matches the marker and top row,
 * and reports anything off rather than guessing silently.
 */
export function readGrid(cells: readonly (readonly Bit[])[], border: Edge): GridReadResult {
  const issues: GridIssue[] = [];
  const b = edgeDepth(border);
  const width = (cells[0]?.length ?? 0) - 2 * b;
  if (width < MIN_WIDTH || cells.length < 2 + 2 * b || cells.some((row) => row.length !== cells[0]!.length)) {
    return { bits: [], orientation: UPRIGHT, issues: [{ kind: "shape", message: "Grid is too small or its rows differ in length." }] };
  }

  const scored = ORIENTATIONS.map((o) => ({ o, grid: transform(cells, o), ...fit(transform(cells, o), b) }));
  const best = scored.reduce((a, c) => (c.score > a.score ? c : a));
  const ties = scored.filter((s) => s.score === best.score);
  const { o, grid, score, max, wrong } = best;

  if (ties.length > 1) {
    issues.push({ kind: "ambiguous-orientation", message: `Marker fits ${ties.length} orientations equally well; read as ${describe(o)}.` });
  } else if (o !== ORIENTATIONS[0]) {
    issues.push({ kind: "orientation", message: `Grid was ${describe(o)}; read the right way round.` });
  }
  if (score < max) issues.push({ kind: "marker", message: `${max - score} of ${max} marker and top-row cells do not match.`, cells: wrong });

  const bits = dataCellOrder(grid.length, grid[0]!.length, border).map(([r, c]) => grid[r]![c]!);
  const lastOne = bits.lastIndexOf(1);
  if (lastOne < 0 || bits.length - lastOne > width) {
    issues.push({ kind: "padding", message: "End-of-message padding (a 1 then 0s in the last row) was not found; all data cells returned." });
    return { bits, orientation: o, issues };
  }
  return { bits: bits.slice(0, lastOne), orientation: o, issues };
}

export type Cell = [row: number, col: number];

/** Upright positions of the data cells in reading order: between marker and top, right to left, bottom up. */
export function dataCellOrder(height: number, width: number, border: Edge): Cell[] {
  const b = edgeDepth(border);
  const out: Cell[] = [];
  for (let r = b + 1; r < height - 1 - b; r++) for (let c = width - 1 - b; c >= b; c--) out.push([r, c]);
  return out;
}

/** Where an upright cell sits in the grid as it was given. Every turn undoes itself, so this maps both ways. */
export function mapCell([r, c]: Cell, o: Orientation, height: number, width: number): Cell {
  if (o.rotated180) [r, c] = [height - 1 - r, width - 1 - c];
  if (o.mirrored) c = width - 1 - c;
  return [r, c];
}
