// Construction translator (packet section 32): turn a chart of what the right
// side should show into what the hands do, row by row.
//
// A chart cell is an outcome, not an action. Knitting flat, every other row is
// worked from the wrong side, in the other direction, and a texture stitch has
// to be worked the opposite way to show correctly on the right side. Colour
// does not invert: a colour-A cell is worked in colour A from either side.
// Knitting in the round, every row is a right-side row.
//
// Chart coordinates: chart[row][col], row 0 is the bottom (row 1, knitted
// first), col 0 is the left edge as seen on the right side.

/**
 * Stitches that are worked only on right-side rows (Phase 4 carriers):
 * c4f / c4b  a 4-stitch cable crossing left (front) or right (back); four cells
 * yo         yarn over, an eyelet
 * k2tog      knit two together, leans right
 * ssk        slip, slip, knit, leans left
 * mb         make a bobble
 * pb         place a bead
 */
export type Special = "c4f" | "c4b" | "yo" | "k2tog" | "ssk" | "mb" | "pb";

/** What the right side shows in one cell. Carriers produce these. */
export type Visible = "knit" | "purl" | "A" | "B" | Special;

export type Stitch = "k" | "p" | Special;

export const SPECIALS: readonly Special[] = ["c4f", "c4b", "yo", "k2tog", "ssk", "mb", "pb"];
export const isSpecial = (v: string): v is Special => (SPECIALS as readonly string[]).includes(v);
/** Chart cells a special stitch covers: cables are four stitches wide. */
export const cellsOf = (s: Special): number => (s === "c4f" || s === "c4b" ? 4 : 1);

export interface Action {
  stitch: Stitch;
  /** Yarn to use, for colourwork cells. */
  colour?: "A" | "B";
  /** Stitches on the needle after this action, when not 1 (a cable leaves 4). */
  span?: number;
}

export interface Construction {
  method: "flat" | "round";
  /** Flat only: which side row 1 is worked from. Usually RS. */
  firstRow: "RS" | "WS";
}

export const FLAT: Construction = { method: "flat", firstRow: "RS" };
export const ROUND: Construction = { method: "round", firstRow: "RS" };

export interface Row {
  /** 1-based knitting row (or round). */
  number: number;
  side: "RS" | "WS";
  /** Direction to read the chart row: RS rows right to left, WS rows left to right. */
  read: "right-to-left" | "left-to-right";
  /** Actions in the order they are worked. */
  actions: Action[];
}

function act(cell: Visible, side: "RS" | "WS", row: number): Action {
  if (isSpecial(cell)) {
    if (side === "WS") throw new Error(`Row ${row}: ${cell} is worked on right-side rows only. Start flat work on a right-side row, or knit in the round.`);
    return cellsOf(cell) > 1 ? { stitch: cell, span: cellsOf(cell) } : { stitch: cell };
  }
  // Colourwork sits on stockinette: knit on the RS, purl on the WS.
  if (cell === "A" || cell === "B") return { stitch: side === "RS" ? "k" : "p", colour: cell };
  const shown: Stitch = cell === "knit" ? "k" : "p";
  return { stitch: side === "RS" ? shown : shown === "k" ? "p" : "k" };
}

/** Right-side chart to rows of actions. */
export function translate(chart: readonly (readonly Visible[])[], construction: Construction): Row[] {
  return chart.map((cells, r) => {
    const side = construction.method === "round" ? "RS" : (r % 2 === 0) === (construction.firstRow === "RS") ? "RS" : "WS";
    const ordered = side === "RS" ? [...cells].reverse() : [...cells];
    const actions: Action[] = [];
    for (let i = 0; i < ordered.length; ) {
      const c = ordered[i]!;
      const n = isSpecial(c) ? cellsOf(c) : 1;
      // A cable covers four cells of the same kind; anything else is a chart error to report.
      if (n > 1 && ordered.slice(i, i + n).some((x) => x !== c)) throw new Error(`Row ${r + 1}: a ${c} cable needs ${n} matching cells in a row.`);
      actions.push(act(c, side, r + 1));
      i += n;
    }
    return { number: r + 1, side, read: side === "RS" ? "right-to-left" : "left-to-right", actions };
  });
}

/** Rows of actions back to the right-side chart they make. The inverse of translate. */
export function toChart(rows: readonly Row[]): Visible[][] {
  return rows.map((row) => {
    const cells = row.actions.flatMap((a): Visible[] => {
      if (a.colour) return [a.colour];
      if (isSpecial(a.stitch)) return new Array<Visible>(a.span ?? 1).fill(a.stitch);
      const shown = row.side === "RS" ? a.stitch : a.stitch === "k" ? "p" : "k";
      return [shown === "k" ? "knit" : "purl"];
    });
    return row.side === "RS" ? cells.reverse() : cells;
  });
}
