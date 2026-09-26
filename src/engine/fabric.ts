// Fabric renderer (Phase G1): draw a chart as knitted fabric, in the site's
// drawn dossier style rather than a photograph. Seeded, so the same case
// always gives the same picture. Pure string building, no DOM.
//
// Stockinette stitches are wider than tall. A knit stitch shows as a V (two
// tilted legs); a purl stitch as a horizontal bump. Rows are drawn top first so
// each lower row's legs sit over the one above, as they do in real fabric.

import { type Visible } from "./construction";

/** Small, fast, seedable PRNG (mulberry32). Returns numbers in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FabricOptions {
  seed: number;
  /** 0 is machine-even, 1 is a nervous first project. */
  wobble?: number;
  /** Stitch width in px; height is 0.78 of it. */
  stitch?: number;
  /** Yarn colours for purl relief (A) and colourwork (A, B). */
  colours?: { A: string; B: string };
  /** Accessible name for the image. */
  label?: string;
}

const INK = "#16140f";
const GAP = "#cfc6b1";
const PAPER = "#f3eee2";

const f = (n: number) => Math.round(n * 10) / 10;

function knitV(x: number, y: number, w: number, h: number, fill: string, tilt: number, r: () => number): string {
  // Two legs meeting low in the cell, reaching up past the top edge.
  const legW = w * 0.46;
  const legH = h * 1.08;
  const cy = y + h * 0.5;
  const leg = (dx: number, rot: number) =>
    `<ellipse cx="${f(x + w / 2 + dx)}" cy="${f(cy)}" rx="${f(legW / 2)}" ry="${f(legH / 2)}" transform="rotate(${f(rot + tilt)} ${f(x + w / 2 + dx)} ${f(cy)})" fill="${fill}" stroke="${INK}" stroke-width="0.9"/>`;
  const ply = (dx: number, rot: number) =>
    `<line x1="${f(x + w / 2 + dx)}" y1="${f(cy - legH * 0.32)}" x2="${f(x + w / 2 + dx)}" y2="${f(cy + legH * 0.32)}" transform="rotate(${f(rot + tilt + (r() - 0.5) * 6)} ${f(x + w / 2 + dx)} ${f(cy)})" stroke="${INK}" stroke-opacity="0.25" stroke-width="0.6"/>`;
  // Left leg leans left at the top, right leg leans right: a V, open at the top.
  return leg(-w * 0.21, -26) + leg(w * 0.21, 26) + ply(-w * 0.21, -26) + ply(w * 0.21, 26);
}

function purlBump(x: number, y: number, w: number, h: number, fill: string, tilt: number): string {
  // A rounded bar across the cell, with a shadow under it.
  const cx = x + w / 2;
  const cy = y + h * 0.5;
  return (
    `<ellipse cx="${f(cx)}" cy="${f(cy + h * 0.12)}" rx="${f(w * 0.5)}" ry="${f(h * 0.3)}" fill="${INK}" fill-opacity="0.18"/>` +
    `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(w * 0.52)}" ry="${f(h * 0.36)}" transform="rotate(${f(tilt)} ${f(cx)} ${f(cy)})" fill="${fill}" stroke="${INK}" stroke-width="0.9"/>` +
    `<path d="M${f(x + w * 0.18)} ${f(cy - h * 0.06)} Q${f(cx)} ${f(cy - h * 0.2)} ${f(x + w * 0.82)} ${f(cy - h * 0.06)}" fill="none" stroke="${INK}" stroke-opacity="0.3" stroke-width="0.6"/>`
  );
}

/** Draw a chart (row 0 at the bottom, col 0 on the left) as fabric. */
export function fabricSvg(chart: readonly (readonly Visible[])[], opts: FabricOptions): string {
  const r = rng(opts.seed);
  const wobble = opts.wobble ?? 0.5;
  const w = opts.stitch ?? 22;
  const baseH = w * 0.78;
  const colours = opts.colours ?? { A: "#f9f6ee", B: "#c8201e" };
  const rows = chart.length;
  const cols = chart[0]?.length ?? 0;
  const pad = w * 0.8;

  // Uneven tension: each row gets its own height.
  const heights = chart.map(() => baseH * (1 + (r() - 0.5) * 0.12 * wobble));
  const total = heights.reduce((a, b) => a + b, 0);
  const width = cols * w + pad * 2;
  const height = total + pad * 2;

  const parts: string[] = [`<rect width="${f(width)}" height="${f(height)}" fill="${PAPER}"/>`, `<rect x="${f(pad - 2)}" y="${f(pad - 2)}" width="${f(cols * w + 4)}" height="${f(total + 4)}" fill="${GAP}"/>`];
  let y = pad;
  for (let row = rows - 1; row >= 0; row--) {
    const h = heights[row]!;
    const drift = (r() - 0.5) * 2 * wobble; // a whole row can lean a little
    chart[row]!.forEach((v, col) => {
      const x = pad + col * w + (r() - 0.5) * 1.6 * wobble;
      const yy = y + (r() - 0.5) * 1.4 * wobble;
      const tilt = (r() - 0.5) * 8 * wobble + drift;
      const fill = v === "B" ? colours.B : colours.A;
      const body = v === "purl" ? purlBump(x, yy, w, h, fill, tilt) : knitV(x, yy, w, h, fill, tilt, r);
      parts.push(`<g data-row="${row}" data-col="${col}" data-state="${v}">${body}</g>`);
    });
    y += h;
  }

  const label = opts.label ?? `Drawing of knitted fabric, ${rows} rows of ${cols} stitches`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}" height="${f(height)}" viewBox="0 0 ${f(width)} ${f(height)}" role="img" aria-label="${label.replace(/"/g, "&quot;")}">`,
    ...parts,
    "</svg>",
  ].join("\n");
}
