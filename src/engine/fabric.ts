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

/** A decrease: one leg, leaning right (k2tog) or left (ssk), lying over its neighbour. */
function decrease(x: number, y: number, w: number, h: number, fill: string, lean: 1 | -1, tilt: number): string {
  const cx = x + w / 2;
  const cy = y + h * 0.5;
  return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(w * 0.3)}" ry="${f(h * 0.62)}" transform="rotate(${f(lean * 38 + tilt)} ${f(cx)} ${f(cy)})" fill="${fill}" stroke="${INK}" stroke-width="1.1"/>`;
}

/** A yarn-over: an open eyelet, a ring of yarn round a hole. */
function eyelet(x: number, y: number, w: number, h: number, fill: string): string {
  const cx = x + w / 2;
  const cy = y + h * 0.5;
  return (
    `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(w * 0.42)}" ry="${f(h * 0.44)}" fill="${fill}" stroke="${INK}" stroke-width="0.9"/>` +
    `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(w * 0.24)}" ry="${f(h * 0.26)}" fill="${INK}" fill-opacity="0.82"/>`
  );
}

/** A bobble: a round knot standing out of the fabric, with a shadow under it. */
function bobble(x: number, y: number, w: number, h: number, fill: string): string {
  const cx = x + w / 2;
  const cy = y + h * 0.45;
  const r = w * 0.62;
  return (
    `<ellipse cx="${f(cx + r * 0.12)}" cy="${f(cy + r * 0.3)}" rx="${f(r)}" ry="${f(r * 0.8)}" fill="${INK}" fill-opacity="0.25"/>` +
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" stroke="${INK}" stroke-width="1.1"/>` +
    `<path d="M${f(cx - r * 0.55)} ${f(cy - r * 0.1)} Q${f(cx)} ${f(cy - r * 0.75)} ${f(cx + r * 0.55)} ${f(cy - r * 0.1)}" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="0.8"/>`
  );
}

/** A bead sitting on a knit stitch: a small glass sphere with a glint. */
function bead(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const cy = y + h * 0.5;
  const r = Math.min(w, h) * 0.3;
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${INK}" fill-opacity="0.85" stroke="${INK}" stroke-width="0.8"/><circle cx="${f(cx - r * 0.35)}" cy="${f(cy - r * 0.35)}" r="${f(r * 0.28)}" fill="#f9f6ee"/>`;
}

/**
 * A 4-stitch cable crossing, drawn once across its four cells: two strands of two stitches each,
 * the front one over the back. C4F leans left going up (front strand from bottom right to top left),
 * C4B leans right.
 */
function cableCross(x: number, y: number, w: number, h: number, fill: string, leftLean: boolean): string {
  const [x0, x1] = [x + w, x + 3 * w];
  const [top, bottom] = [y - h * 0.25, y + h * 1.25];
  const strand = (from: number, to: number) => {
    const d = `M${f(from)} ${f(bottom)} C${f(from)} ${f(y + h * 0.5)} ${f(to)} ${f(y + h * 0.5)} ${f(to)} ${f(top)}`;
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(w * 1.75)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${f(w * 1.55)}" stroke-linecap="round"/>`;
  };
  // Back strand first, then the front one over it.
  return leftLean ? strand(x0, x1) + strand(x1, x0) : strand(x1, x0) + strand(x0, x1);
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
  const lifted: string[] = [];
  for (let row = rows - 1; row >= 0; row--) {
    const h = heights[row]!;
    const drift = (r() - 0.5) * 2 * wobble; // a whole row can lean a little
    // Cables and bobbles stand proud of the fabric: draw them after the row's flat stitches.
    const raised: string[] = [];
    let run = 0;
    chart[row]!.forEach((v, col) => {
      const x = pad + col * w + (r() - 0.5) * 1.6 * wobble;
      const yy = y + (r() - 0.5) * 1.4 * wobble;
      const tilt = (r() - 0.5) * 8 * wobble + drift;
      const fill = v === "B" ? colours.B : colours.A;
      run = col > 0 && chart[row]![col - 1] === v ? run + 1 : 0;
      if (v === "c4f" || v === "c4b") {
        // Knit columns under the crossing; the crossing itself once per four cells.
        parts.push(`<g data-row="${row}" data-col="${col}" data-state="${v}">${knitV(x, yy, w, h, fill, tilt, r)}</g>`);
        if (run % 4 === 0) raised.push(`<g data-row="${row}" data-col="${col}" data-state="${v}-cross">${cableCross(pad + col * w, yy, w, h, fill, v === "c4f")}</g>`);
        return;
      }
      const body =
        v === "purl" ? purlBump(x, yy, w, h, fill, tilt)
        : v === "yo" ? eyelet(x, yy, w, h, fill)
        : v === "k2tog" ? decrease(x, yy, w, h, fill, 1, tilt)
        : v === "ssk" ? decrease(x, yy, w, h, fill, -1, tilt)
        : v === "mb" ? knitV(x, yy, w, h, fill, tilt, r)
        : v === "pb" ? knitV(x, yy, w, h, fill, tilt, r) + bead(x, yy, w, h)
        : knitV(x, yy, w, h, fill, tilt, r);
      parts.push(`<g data-row="${row}" data-col="${col}" data-state="${v}">${body}</g>`);
      if (v === "mb") raised.push(`<g data-row="${row}" data-col="${col}" data-state="mb-knot">${bobble(x, yy, w, h, fill)}</g>`);
    });
    lifted.push(...raised);
    y += h;
  }
  parts.push(...lifted);

  const label = opts.label ?? `Drawing of knitted fabric, ${rows} rows of ${cols} stitches`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}" height="${f(height)}" viewBox="0 0 ${f(width)} ${f(height)}" role="img" aria-label="${label.replace(/"/g, "&quot;")}">`,
    ...parts,
    "</svg>",
  ].join("\n");
}
