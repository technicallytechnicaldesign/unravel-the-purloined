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

/** What the right side shows in one cell. Carriers produce these. */
export type Visible = "knit" | "purl" | "A" | "B";

export type Stitch = "k" | "p";

export interface Action {
  stitch: Stitch;
  /** Yarn to use, for colourwork cells. */
  colour?: "A" | "B";
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

function act(cell: Visible, side: "RS" | "WS"): Action {
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
    return {
      number: r + 1,
      side,
      read: side === "RS" ? "right-to-left" : "left-to-right",
      actions: ordered.map((c) => act(c, side)),
    };
  });
}

/** Rows of actions back to the right-side chart they make. The inverse of translate. */
export function toChart(rows: readonly Row[]): Visible[][] {
  return rows.map((row) => {
    const cells = row.actions.map((a): Visible => {
      if (a.colour) return a.colour;
      const shown = row.side === "RS" ? a.stitch : a.stitch === "k" ? "p" : "k";
      return shown === "k" ? "knit" : "purl";
    });
    return row.side === "RS" ? cells.reverse() : cells;
  });
}
