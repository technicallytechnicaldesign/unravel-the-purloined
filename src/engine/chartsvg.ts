// SVG chart export: a standalone, printable knitting chart. Pure string
// building, no DOM, so it runs anywhere the engine runs.
//
// Chart conventions: row 1 at the bottom, stitch 1 on the right. Flat charts
// number RS rows on the right and WS rows on the left, where each row starts.
// Colours are the light palette from src/style.css, fixed for print.

import { type Row, type Visible } from "./construction";
import { type LegendEntry } from "./carrier";

const INK = "#16140f";
const RULE = "#cfc6b1";
const PAPER = "#f3eee2";
const KNIT = "#f9f6ee";
const RED = "#c8201e";
const FONT = "'IBM Plex Mono', ui-monospace, Consolas, monospace";

const CELL = 16;
const GUTTER = 32;
const HEAD = 36;
const FOOT = 24;
const LEGEND_LINE = 20;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const line = (x1: number, y1: number, x2: number, y2: number, w = 1.4, stroke = INK) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;

/** A cable symbol across `n` cells: the front strand drawn over the back one. C4F leans "\\", C4B "/". */
function cable(v: "c4f" | "c4b", x: number, y: number, n: number): string {
  const [l, r, t, b] = [x + 2, x + n * CELL - 2, y + 3, y + CELL - 3];
  const [back, front] = v === "c4f" ? [[l, b, r, t], [l, t, r, b]] : [[l, t, r, b], [l, b, r, t]];
  return (
    `<rect x="${x}" y="${y}" width="${n * CELL}" height="${CELL}" fill="${KNIT}"/>` +
    line(back[0]!, back[1]!, back[2]!, back[3]!, 1) +
    line(front[0]!, front[1]!, front[2]!, front[3]!, 6, KNIT) +
    line(front[0]!, front[1]!, front[2]!, front[3]!, 2.4)
  );
}

function cell(v: Visible, x: number, y: number): string {
  if (v === "c4f" || v === "c4b") return cable(v, x, y, 1);
  const fill = v === "B" ? INK : KNIT;
  const [cx, cy, m] = [x + CELL / 2, y + CELL / 2, 4];
  let out = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${fill}"/>`;
  if (v === "purl") out += `<circle cx="${cx}" cy="${cy}" r="3" fill="${INK}"/>`;
  if (v === "yo") out += `<circle cx="${cx}" cy="${cy}" r="4" fill="none" stroke="${INK}" stroke-width="1.3"/>`;
  if (v === "k2tog") out += line(x + m, y + CELL - m, x + CELL - m, y + m);
  if (v === "ssk") out += line(x + m, y + m, x + CELL - m, y + CELL - m);
  if (v === "mb") out += `<circle cx="${cx}" cy="${cy}" r="5" fill="${INK}"/>`;
  if (v === "pb") out += `<path d="M${cx} ${y + 3}L${x + CELL - 3} ${cy}L${cx} ${y + CELL - 3}L${x + 3} ${cy}Z" fill="${INK}"/>`;
  return out;
}

/** Short key lines for stitches the chart uses that the carrier legend does not name. */
const STITCH_KEY: Partial<Record<Visible, string>> = {
  purl: "purl on the right side",
  yo: "yo: yarn over, an eyelet",
  k2tog: "k2tog: knit 2 together, leans right",
  ssk: "ssk: slip, slip, knit, leans left",
  c4f: "C4F: cable 4, crossing to the left",
  c4b: "C4B: cable 4, crossing to the right",
  mb: "MB: make a bobble",
  pb: "PB: place a bead",
};

/** The carrier legend plus a line for every other symbol in the chart. */
export function keyFor(chart: readonly (readonly Visible[])[], legend: readonly LegendEntry[]): LegendEntry[] {
  const used = new Set(chart.flat());
  const named = new Set(legend.map((l) => l.visible));
  const extra = (Object.keys(STITCH_KEY) as Visible[])
    .filter((v) => used.has(v) && !named.has(v))
    .map((v): LegendEntry => ({ bit: 0, visible: v, symbol: "", label: STITCH_KEY[v]! }));
  return [...legend, ...extra];
}

export interface ChartSvgInput {
  title: string;
  chart: readonly (readonly Visible[])[];
  rows: readonly Row[];
  method: "flat" | "round";
  legend: readonly LegendEntry[];
}

export function chartSvg({ title, chart, rows, method, legend: carrierLegend }: ChartSvgInput): string {
  const legend = keyFor(chart, carrierLegend);
  const h = chart.length;
  const w = chart[0]?.length ?? 0;
  const gridW = w * CELL;
  const gridH = h * CELL;
  const width = GUTTER * 2 + Math.max(gridW, 200);
  const height = HEAD + gridH + FOOT + legend.length * LEGEND_LINE + 8;
  const x0 = GUTTER;
  const y0 = HEAD;
  const text = (x: number, y: number, s: string, anchor = "middle", size = 10) =>
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${INK}">${esc(s)}</text>`;

  const parts: string[] = [];
  parts.push(`<rect width="${width}" height="${height}" fill="${PAPER}"/>`);
  parts.push(text(x0, 22, title, "start", 13));

  chart.forEach((row, r) => {
    const y = y0 + (h - 1 - r) * CELL;
    for (let c = 0; c < row.length; c++) {
      const v = row[c]!;
      // A cable covers four cells; draw it as one symbol.
      if ((v === "c4f" || v === "c4b") && row.slice(c, c + 4).every((x) => x === v)) {
        parts.push(cable(v, x0 + c * CELL, y, 4));
        c += 3;
      } else parts.push(cell(v, x0 + c * CELL, y));
    }
    const side = rows[r]?.side ?? "RS";
    const right = method === "round" || side === "RS";
    parts.push(text(right ? x0 + gridW + 6 : x0 - 6, y + CELL - 4, String(r + 1), right ? "start" : "end"));
  });

  // Grid lines, heavier on the frame and every 10 stitches and rows, counted from stitch 1 on the right and row 1 at the bottom.
  for (let c = 0; c <= w; c++) {
    const heavy = c === 0 || (w - c) % 10 === 0;
    parts.push(`<line x1="${x0 + c * CELL}" y1="${y0}" x2="${x0 + c * CELL}" y2="${y0 + gridH}" stroke="${heavy ? INK : RULE}" stroke-width="${heavy ? 1.2 : 0.6}"/>`);
  }
  for (let r = 0; r <= h; r++) {
    const heavy = r === h || r % 10 === 0;
    const y = y0 + gridH - r * CELL;
    parts.push(`<line x1="${x0}" y1="${y}" x2="${x0 + gridW}" y2="${y}" stroke="${heavy ? INK : RULE}" stroke-width="${heavy ? 1.2 : 0.6}"/>`);
  }

  // Stitch numbers under the chart: 1 on the right, then every 5.
  for (let s = 1; s <= w; s++) {
    if (s === 1 || s % 5 === 0) parts.push(text(x0 + (w - s) * CELL + CELL / 2, y0 + gridH + 14, String(s)));
  }

  legend.forEach((l, i) => {
    const y = y0 + gridH + FOOT + i * LEGEND_LINE;
    parts.push(cell(l.visible, x0, y));
    parts.push(`<rect x="${x0}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="${RED}" stroke-width="0.8"/>`);
    parts.push(text(x0 + CELL + 8, y + CELL - 4, l.label, "start"));
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">`,
    `<title>${esc(title)}</title>`,
    ...parts,
    "</svg>",
  ].join("\n");
}
