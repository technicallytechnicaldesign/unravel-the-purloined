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

function cell(v: Visible, x: number, y: number): string {
  const fill = v === "B" ? INK : KNIT;
  let out = `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${fill}"/>`;
  if (v === "purl") out += `<circle cx="${x + CELL / 2}" cy="${y + CELL / 2}" r="3" fill="${INK}"/>`;
  return out;
}

export interface ChartSvgInput {
  title: string;
  chart: readonly (readonly Visible[])[];
  rows: readonly Row[];
  method: "flat" | "round";
  legend: readonly LegendEntry[];
}

export function chartSvg({ title, chart, rows, method, legend }: ChartSvgInput): string {
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
    row.forEach((v, c) => parts.push(cell(v, x0 + c * CELL, y)));
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
