// Unit carriers (Phase 4, packet 27.6 to 27.8): each cell of the logical grid
// becomes a small block of real stitches, and the block's two versions carry
// 0 and 1. The grid underneath is unchanged, so the marker row, the error
// checks and hiding all keep working.
//
//   cable   6 x 4   p1, a 4-stitch cable, p1; crossing left (C4F) is 0, right (C4B) is 1
//   lace    4 x 2   k1, a lace pair, k1; ssk then yo (leans left) is 0, yo then k2tog (leans right) is 1
//   bobble  3 x 2   a bobble in the middle is 1, plain is 0
//   bead    2 x 2   a bead on the first stitch is 1, plain is 0
//
// Every block is an even number of rows tall and puts its special row first,
// so special stitches always land on right-side rows. Bobbles and beads are
// not Braille; the packet asks for real tactile research before any claim.

import { type Bit } from "./fivebit";
import { type Visible } from "./construction";
import { type Cell, type CellRole } from "./grid";
import { type LegendEntry } from "./carrier";

export type UnitId = "cable" | "lace" | "bobble" | "bead";

export interface Unit {
  id: UnitId;
  name: string;
  width: number;
  height: number;
  /** The block for a bit, row 0 at the bottom; `special` is the row that holds the special stitches. */
  block(bit: Bit, special: number): Visible[][];
  legend: LegendEntry[];
  notes: string[];
}

const plainRow = (w: number, edges: Visible = "knit"): Visible[] => Array.from({ length: w }, (_, i) => (i === 0 || i === w - 1 ? edges : "knit"));

/** A block `height` rows tall where row `special` is `row` and the rest are background. */
function block(height: number, special: number, row: Visible[], background: Visible[]): Visible[][] {
  return Array.from({ length: height }, (_, r) => [...(r === special ? row : background)]);
}

export const UNITS: Record<UnitId, Unit> = {
  cable: {
    id: "cable",
    name: "Cables (left or right cross)",
    width: 6,
    height: 4,
    block: (bit, special) => block(4, special, ["purl", ...new Array<Visible>(4).fill(bit ? "c4b" : "c4f"), "purl"], plainRow(6, "purl")),
    legend: [
      { bit: 0, visible: "c4f", symbol: "\\", label: "C4F: cable crossing to the left (0)" },
      { bit: 1, visible: "c4b", symbol: "/", label: "C4B: cable crossing to the right (1)" },
    ],
    notes: [
      "Each cable crosses once every four rows; the direction of the cross is the bit. Cables pull in, so the piece will be narrower than stockinette over the same stitches.",
      "Read it back by looking at each crossing: leaning left is 0, leaning right is 1.",
    ],
  },
  lace: {
    id: "lace",
    name: "Lace (left or right lean)",
    width: 4,
    height: 2,
    block: (bit, special) => block(2, special, bit ? ["knit", "yo", "k2tog", "knit"] : ["knit", "ssk", "yo", "knit"], plainRow(4)),
    legend: [
      { bit: 0, visible: "ssk", symbol: "\\", label: "ssk, yo: a decrease leaning left beside an eyelet (0)" },
      { bit: 1, visible: "k2tog", symbol: "/", label: "yo, k2tog: an eyelet beside a decrease leaning right (1)" },
    ],
    notes: [
      "Every eyelet is paired with a decrease, so the stitch count stays the same on every row.",
      "Block the finished piece well so the eyelets open and the leans show.",
    ],
  },
  bobble: {
    id: "bobble",
    name: "Bobbles (there or not)",
    width: 3,
    height: 2,
    block: (bit, special) => block(2, special, ["knit", bit ? "mb" : "knit", "knit"], plainRow(3)),
    legend: [
      { bit: 0, visible: "knit", symbol: " ", label: "No bobble (0)" },
      { bit: 1, visible: "mb", symbol: "●", label: "MB: a bobble (1)" },
    ],
    notes: ["Bobbles are easy to feel and to see, and heavy: large pieces may drape differently. These are not Braille."],
  },
  bead: {
    id: "bead",
    name: "Beads (there or not)",
    width: 2,
    height: 2,
    block: (bit, special) => block(2, special, [bit ? "pb" : "knit", "knit"], plainRow(2)),
    legend: [
      { bit: 0, visible: "knit", symbol: " ", label: "No bead (0)" },
      { bit: 1, visible: "pb", symbol: "◆", label: "PB: a bead (1)" },
    ],
    notes: ["Count the PB stitches in the chart before you start: one bead for each. Beads are not Braille."],
  },
};

/** Grid cells to stitches: each cell becomes a block; border cells become plain background. */
export function expandUnits(cells: readonly (readonly Bit[])[], roles: readonly (readonly CellRole[])[], unit: Unit, special: number): { chart: Visible[][]; roles: CellRole[][] } {
  const rows = cells.length * unit.height;
  const cols = (cells[0]?.length ?? 0) * unit.width;
  const chart: Visible[][] = Array.from({ length: rows }, () => new Array<Visible>(cols));
  const outRoles: CellRole[][] = Array.from({ length: rows }, () => new Array<CellRole>(cols));
  cells.forEach((row, gr) =>
    row.forEach((bit, gc) => {
      const role = roles[gr]![gc]!;
      const b = role === "border" ? Array.from({ length: unit.height }, () => new Array<Visible>(unit.width).fill("knit")) : unit.block(bit, special);
      b.forEach((line, r) =>
        line.forEach((v, c) => {
          chart[gr * unit.height + r]![gc * unit.width + c] = v;
          outRoles[gr * unit.height + r]![gc * unit.width + c] = role;
        }),
      );
    }),
  );
  return { chart, roles: outRoles };
}

export interface UnitNote {
  cell: Cell;
  message: string;
}

/**
 * Stitches back to grid cells: each block is compared with its two versions
 * and read as the nearer. Blocks that match neither exactly are reported.
 */
export function reduceUnits(chart: readonly (readonly Visible[])[], unit: Unit, special: number): { cells: Bit[][]; notes: UnitNote[] } {
  const rows = Math.floor(chart.length / unit.height);
  const cols = Math.floor((chart[0]?.length ?? 0) / unit.width);
  const [zero, one] = [unit.block(0, special), unit.block(1, special)];
  const notes: UnitNote[] = [];
  const cells = Array.from({ length: rows }, (_, gr) =>
    Array.from({ length: cols }, (_, gc) => {
      const off = (v: Visible[][]) => v.reduce((n, line, r) => n + line.reduce((k, x, c) => k + (chart[gr * unit.height + r]![gc * unit.width + c] === x ? 0 : 1), 0), 0);
      const [d0, d1] = [off(zero), off(one)];
      const bit: Bit = d1 < d0 ? 1 : 0;
      if (Math.min(d0, d1) > 0) notes.push({ cell: [gr, gc], message: `A ${unit.id} block matches neither version exactly (${Math.min(d0, d1)} stitches off); read as ${bit}.` });
      return bit;
    }),
  );
  return { cells, notes };
}
