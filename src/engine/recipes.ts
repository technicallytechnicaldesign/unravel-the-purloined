// Project recipes (task T14): a recipe is a set of sensible starting values
// for a real object, plus the plain sections that come before and after the
// chart. The chart itself (and so the message and its decoding) never
// changes with the recipe; only the words around it do.

import { translate, type Construction, type Row } from "./construction";
import { writeRow } from "./pattern";
import { section, type StitchPattern } from "./stitches";
import { family, type CarrierId } from "./carrier";

export type RecipeId = "swatch" | "scarf" | "cowl" | "hat-band";

export interface Recipe {
  id: RecipeId;
  name: string;
  summary: string;
  method: "flat" | "round";
  /** Message cells per row. */
  width: number;
  borderWidth: number;
  border: Record<"purl-relief" | "two-colour", StitchPattern>;
  /** Plain rows below and above the chart (kept even so right and wrong sides line up). */
  edgeRows: { below: number; above: number };
  edge: Record<"purl-relief" | "two-colour", StitchPattern>;
  finish: string;
}

export const RECIPES: Record<RecipeId, Recipe> = {
  swatch: {
    id: "swatch",
    name: "Square swatch",
    summary: "A small flat test piece. Good for a first message.",
    method: "flat",
    width: 12,
    borderWidth: 2,
    border: { "purl-relief": "garter", "two-colour": "solid-a" },
    edgeRows: { below: 0, above: 0 },
    edge: { "purl-relief": "garter", "two-colour": "solid-a" },
    finish: "Bind off. Block flat so the stitches open out and the message reads clearly.",
  },
  scarf: {
    id: "scarf",
    name: "Scarf",
    summary: "Knitted flat, with a seed-stitch frame so the edges lie flat.",
    method: "flat",
    width: 24,
    borderWidth: 3,
    border: { "purl-relief": "seed", "two-colour": "checker" },
    edgeRows: { below: 12, above: 12 },
    edge: { "purl-relief": "seed", "two-colour": "stripes" },
    finish: "Continue the plain edge pattern to the length you want, then bind off in pattern.",
  },
  cowl: {
    id: "cowl",
    name: "Cowl",
    summary: "A tube knitted in the round, with ribbed edges.",
    method: "round",
    width: 60,
    borderWidth: 2,
    border: { "purl-relief": "rib2", "two-colour": "solid-a" },
    edgeRows: { below: 8, above: 8 },
    edge: { "purl-relief": "rib2", "two-colour": "stripes" },
    finish: "Bind off loosely in pattern.",
  },
  "hat-band": {
    id: "hat-band",
    name: "Hat band",
    summary: "A ribbed brim and a message band, knitted in the round. Finish the crown with any hat pattern you like.",
    method: "round",
    width: 84,
    borderWidth: 2,
    border: { "purl-relief": "rib2", "two-colour": "solid-a" },
    edgeRows: { below: 10, above: 0 },
    edge: { "purl-relief": "rib2", "two-colour": "solid-a" },
    finish: "Continue with the crown of your favourite hat pattern from here.",
  },
};

export interface Edges {
  below: number;
  above: number;
  pattern: StitchPattern;
}

/** Even row counts only: an odd count would put the chart's first row on the wrong side. */
export const evenRows = (n: number): number => Math.max(0, 2 * Math.ceil(Math.floor(n) / 2));

/**
 * Written instructions for a plain section. Repeating rows are shortened to
 * "Repeat these N rows M more times", the way patterns are usually written.
 */
export function writeSection(title: string, rows: readonly Row[], method: "flat" | "round"): string[] {
  if (!rows.length) return [];
  const unit = method === "round" ? "round" : "row";
  const body = (r: Row) => writeRow(r, method).replace(/^(Row|Round) \d+/, "");
  const period = [1, 2, 4].find((p) => rows.length % p === 0 && rows.every((r, i) => body(r) === body(rows[i % p]!)));
  const head = `${title} (${rows.length} ${unit}${rows.length === 1 ? "" : "s"}):`;
  if (!period || period === rows.length) return [head, ...rows.map((r) => writeRow(r, method))];
  const times = rows.length / period - 1;
  return [
    head,
    ...rows.slice(0, period).map((r) => writeRow(r, method)),
    `Repeat ${period === 1 ? `this ${unit}` : `these ${period} ${unit}s`} ${times} more time${times === 1 ? "" : "s"}.`,
  ];
}

/** Rows of a plain section, starting on the side that follows what came before. */
export function sectionRows(count: number, stitches: number, pattern: StitchPattern, construction: Construction, startsOnOtherSide: boolean): Row[] {
  const firstRow = construction.method === "flat" && startsOnOtherSide ? (construction.firstRow === "RS" ? "WS" : "RS") : construction.firstRow;
  return translate(section(count, stitches, pattern), { ...construction, firstRow });
}

/** Rough finished size at a stated gauge, in whole centimetres. */
export function dimensions(stitches: number, rows: number, method: "flat" | "round", gauge = { stitches: 22, rows: 30 }): string {
  const w = Math.round((stitches / gauge.stitches) * 10);
  const h = Math.round((rows / gauge.rows) * 10);
  return `About ${w} cm ${method === "round" ? "around" : "wide"} and ${h} cm tall, at a gauge of ${gauge.stitches} stitches and ${gauge.rows} rows to 10 cm. Knit a swatch and adjust the width if your gauge differs.`;
}

/** The settings a recipe starts from, for a carrier. Everything can still be changed afterwards. */
export function fromRecipe(id: RecipeId, carrier: CarrierId) {
  const r = RECIPES[id];
  return {
    recipe: id,
    layout: { width: r.width, border: r.borderWidth > 0, borderWidth: r.borderWidth },
    construction: { method: r.method, firstRow: "RS" } as Construction,
    borderStyle: r.border[family(carrier)],
    edges: { below: r.edgeRows.below, above: r.edgeRows.above, pattern: r.edge[family(carrier)] },
  };
}
