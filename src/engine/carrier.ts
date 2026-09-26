// Carriers (packet sections 27.2, 27.4, 31): map logical cell states to what
// the right side of the fabric shows, with a legend. The engine above never
// knows which carrier is in use; the construction translator below only sees
// visible states.

import { type Bit } from "./fivebit";
import { type Visible } from "./construction";

export type CarrierId = "purl-relief" | "two-colour" | "cable" | "lace" | "bobble" | "bead" | "stripes";

/** Which family of border and filler patterns a carrier takes: textures, or two colours. */
export const family = (id: CarrierId): "purl-relief" | "two-colour" => (id === "two-colour" || id === "stripes" ? "two-colour" : "purl-relief");

export interface LegendEntry {
  bit: Bit;
  visible: Visible;
  /** Chart symbol, following common chart practice where one exists. */
  symbol: string;
  label: string;
}

export interface Carrier {
  id: CarrierId;
  name: string;
  /** Visible state for logical 0 and 1. */
  states: readonly [Visible, Visible];
  legend: LegendEntry[];
  /** Plain notes a knitter should read before starting. */
  notes: string[];
}

export interface ColourNames {
  A: string;
  B: string;
}

export function purlRelief(): Carrier {
  return {
    id: "purl-relief",
    name: "Purl relief",
    states: ["knit", "purl"],
    legend: [
      { bit: 0, visible: "knit", symbol: " ", label: "Knit on the right side (smooth V)" },
      { bit: 1, visible: "purl", symbol: "•", label: "Purl on the right side (bump)" },
    ],
    notes: ["Purl bumps read best on a smooth yarn in a light colour. Stockinette curls at the edges, so a border helps."],
  };
}

export function twoColour(colours: ColourNames = { A: "background", B: "contrast" }): Carrier {
  return {
    id: "two-colour",
    name: "Two-colour",
    states: ["A", "B"],
    legend: [
      { bit: 0, visible: "A", symbol: "□", label: `Colour A (${colours.A})` },
      { bit: 1, visible: "B", symbol: "■", label: `Colour B (${colours.B})` },
    ],
    notes: [
      "Worked in stockinette. Stranded colourwork, double knitting or duplicate stitch all give the same chart.",
      "Duplicate stitch lets you knit the piece plain first and add the message afterwards.",
    ],
  };
}

/** Logical grid to right-side chart. */
export function render(cells: readonly (readonly Bit[])[], carrier: Carrier): Visible[][] {
  return cells.map((row) => row.map((b) => carrier.states[b]));
}

export interface CarrierIssue {
  row: number;
  col: number;
  message: string;
}

/** Right-side chart back to logical cells. States this carrier does not use are reported and read as 0. */
export function read(chart: readonly (readonly Visible[])[], carrier: Carrier): { cells: Bit[][]; issues: CarrierIssue[] } {
  const issues: CarrierIssue[] = [];
  const cells = chart.map((row, r) =>
    row.map((v, c) => {
      const b = carrier.states.indexOf(v);
      if (b < 0) {
        issues.push({ row: r + 1, col: c + 1, message: `Row ${r + 1}, stitch ${c + 1}: "${v}" is not part of the ${carrier.name} carrier; read as 0.` });
        return 0 as Bit;
      }
      return b as Bit;
    }),
  );
  return { cells, issues };
}

export interface Float {
  /** 1-based chart row. */
  row: number;
  /** 1-based first stitch, counted from the left. */
  from: number;
  length: number;
  /** The yarn that floats behind the run. */
  colour: "A" | "B";
}

/**
 * Stranded colourwork carries the unused yarn behind the work. Report every
 * run longer than `limit` stitches, which will need its float caught. Rows
 * that use only one colour carry no second yarn, so they have no floats.
 */
export function longFloats(chart: readonly (readonly Visible[])[], limit = 5): Float[] {
  const out: Float[] = [];
  chart.forEach((row, r) => {
    if (!(row.includes("A") && row.includes("B"))) return;
    let start = 0;
    for (let c = 1; c <= row.length; c++) {
      if (c < row.length && row[c] === row[start]) continue;
      const colour = row[start];
      // A run of one colour leaves the other colour floating behind it.
      if ((colour === "A" || colour === "B") && c - start > limit) {
        out.push({ row: r + 1, from: start + 1, length: c - start, colour: colour === "A" ? "B" : "A" });
      }
      start = c;
    }
  });
  return out;
}
