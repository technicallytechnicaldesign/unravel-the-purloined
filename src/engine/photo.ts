// Photo reading (Phase 8, research spike): turn a photo of fabric into a grid
// of cells for the ordinary decoder. Pure functions on plain pixel arrays,
// no DOM, so the same code runs in tests, experiments and the browser.
//
//   four corners (tapped by a person) -> homography -> sample each cell
//   -> features (colour, or a texture measure for knit/purl)
//   -> two groups -> cells, plus how sure each cell is
//
// Nothing here guesses the corners or the stitch count: a person gives them.
// Doubtful cells are returned so the decoder can mark them for a human look.

import { type Bit } from "./fivebit";

export interface RGBAImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, rows top first, as canvas getImageData gives. */
  data: Uint8ClampedArray | Uint8Array;
}

export type Point = [x: number, y: number];
/** Corners of the chart area as it lies in the photo: top left, top right, bottom right, bottom left. */
export type Quad = [Point, Point, Point, Point];

/** 3 x 3 matrix, row major, mapping (x, y, 1) to homogeneous coordinates. */
export type Homography = number[];

/** The homography taking each point of `from` to the matching point of `to` (direct linear transform). */
export function homography(from: Quad, to: Quad): Homography {
  const A: number[][] = [];
  from.forEach(([x, y], i) => {
    const [u, v] = to[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  // Gaussian elimination with partial pivoting on the 8 x 9 augmented matrix.
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[p]![c]!)) p = r;
    if (Math.abs(A[p]![c]!) < 1e-12) throw new Error("The four corners must not lie on one line.");
    [A[c], A[p]] = [A[p]!, A[c]!];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const k = A[r]![c]! / A[c]![c]!;
      for (let j = c; j < 9; j++) A[r]![j]! -= k * A[c]![j]!;
    }
  }
  return [...A.map((row, i) => row[8]! / row[i]!), 1];
}

export function project(H: Homography, [x, y]: Point): Point {
  const w = H[6]! * x + H[7]! * y + H[8]!;
  return [(H[0]! * x + H[1]! * y + H[2]!) / w, (H[3]! * x + H[4]! * y + H[5]!) / w];
}

/** Bilinear colour at a point, clamped to the image. */
export function pixel(img: RGBAImage, x: number, y: number): [number, number, number] {
  const cx = Math.min(Math.max(x, 0), img.width - 1);
  const cy = Math.min(Math.max(y, 0), img.height - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, img.width - 1);
  const y1 = Math.min(y0 + 1, img.height - 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const at = (xx: number, yy: number, k: number) => img.data[(yy * img.width + xx) * 4 + k]!;
  const mix = (k: number) => (at(x0, y0, k) * (1 - fx) + at(x1, y0, k) * fx) * (1 - fy) + (at(x0, y1, k) * (1 - fx) + at(x1, y1, k) * fx) * fy;
  return [mix(0), mix(1), mix(2)];
}

/** sRGB (0 to 255) to CIELAB, D65. Distances in Lab follow what eyes see better than RGB does. */
export function lab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

export interface CellSample {
  /** Mean colour of the middle of the cell, in Lab. */
  lab: [number, number, number];
  /** Share of edge energy in horizontal edges (0 to 1). Purl bumps lie across; knit Vs stand up. */
  across: number;
  /** Edge directions in 8 bins over half a turn, weighted by strength, summing to 1: moves little when the cell shifts. */
  edges: number[];
  /** Lightness over the whole cell on a small lattice, scaled to mean 0 and spread 1, so light and shadow drop out. */
  patch: number[];
}

/**
 * Sample every cell of a `cols` by `rows` grid inside the quad. Row 0 is the top row as it lies in
 * the photo. Colour comes from the middle `1 - 2 * inset` of each cell, texture from the whole cell.
 */
export function sampleCells(img: RGBAImage, quad: Quad, cols: number, rows: number, inset = 0.25): CellSample[][] {
  const H = homography([[0, 0], [cols, 0], [cols, rows], [0, rows]], quad);
  const n = 8; // sample lattice per cell side
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      let sum: [number, number, number] = [0, 0, 0];
      let k = 0;
      const L: number[][] = [];
      for (let i = 0; i <= n; i++) {
        const lrow: number[] = [];
        for (let j = 0; j <= n; j++) {
          const u = c + j / n;
          const v = r + i / n;
          const [x, y] = project(H, [u, v]);
          const rgb = pixel(img, x, y);
          const lb = lab(rgb);
          lrow.push(lb[0]);
          if (i / n >= inset && i / n <= 1 - inset && j / n >= inset && j / n <= 1 - inset) {
            sum = [sum[0] + lb[0], sum[1] + lb[1], sum[2] + lb[2]];
            k++;
          }
        }
        L.push(lrow);
      }
      let ex = 0;
      let ey = 0;
      const edges = new Array<number>(8).fill(0);
      for (let i = 1; i < n; i++)
        for (let j = 1; j < n; j++) {
          const gx = L[i]![j + 1]! - L[i]![j - 1]!;
          const gy = L[i + 1]![j]! - L[i - 1]![j]!;
          ex += gx * gx;
          ey += gy * gy;
          const angle = (Math.atan2(gy, gx) + Math.PI) % Math.PI;
          edges[Math.min(7, Math.floor((angle / Math.PI) * 8))]! += Math.hypot(gx, gy);
        }
      const total = edges.reduce((t, x) => t + x, 0) || 1;
      const flat = L.flat();
      const mean = flat.reduce((t, x) => t + x, 0) / flat.length;
      const sd = Math.sqrt(flat.reduce((t, x) => t + (x - mean) ** 2, 0) / flat.length) || 1;
      return { lab: [sum[0] / k, sum[1] / k, sum[2] / k], across: ey / (ex + ey || 1), edges: edges.map((x) => x / total), patch: flat.map((x) => (x - mean) / sd) };
    }),
  );
}

export type Feature = "colour" | "hue" | "texture" | "edges" | "shape";

/** The numbers each kind of reading compares. "hue" drops lightness, which shadows and uneven light disturb most. */
const featureOf = (s: CellSample, f: Feature): number[] =>
  f === "texture" ? [s.across] : f === "edges" ? s.edges : f === "shape" ? s.patch : f === "hue" ? [s.lab[1], s.lab[2]] : [s.lab[0], s.lab[1], s.lab[2]];

export interface PhotoRead {
  /** Row 0 at the bottom, as every grid in the lab. 1 is the darker colour, or the stitch with more edges across (purl). */
  cells: Bit[][];
  /** 0 (a coin toss) to 1 (sure), per cell, same layout as cells. */
  confidence: number[][];
  /** Cells below the doubt threshold, [row, col] with row 0 at the bottom. */
  doubtful: [number, number][];
}

/** Split the samples into two groups (2-means) and say how sure each cell is. */
export function classify(samples: CellSample[][], feature: Feature, doubt = 0.2): PhotoRead {
  const flat = samples.flat();
  const pts = flat.map((s) => featureOf(s, feature));
  const d2 = (a: number[], b: number[]) => a.reduce((t, x, i) => t + (x - b[i]!) ** 2, 0);
  // Start from the two points farthest apart (from the first point's farthest, then its farthest).
  const far = (p: number[]) => pts.reduce((best, q) => (d2(q, p) > d2(best, p) ? q : best), pts[0]!);
  let c0 = far(pts[0]!);
  let c1 = far(c0);
  let labels: number[] = [];
  for (let it = 0; it < 20; it++) {
    labels = pts.map((p) => (d2(p, c0) <= d2(p, c1) ? 0 : 1));
    const mean = (g: number) => {
      const members = pts.filter((_, i) => labels[i] === g);
      return members.length ? members[0]!.map((_, k) => members.reduce((t, m) => t + m[k]!, 0) / members.length) : g ? c1 : c0;
    };
    const [n0, n1] = [mean(0), mean(1)];
    if (d2(n0, c0) + d2(n1, c1) < 1e-9) break;
    [c0, c1] = [n0, n1];
  }
  // Group 1 is the darker colour, or the texture with more edges across.
  const across = (g: number) => flat.filter((_, i) => labels[i] === g).reduce((t, x) => t + x.across, 0) / (labels.filter((l) => l === g).length || 1);
  const flip = feature === "texture" || feature === "edges" || feature === "shape" ? across(0) > across(1) : meanL(flat, labels, 0) < meanL(flat, labels, 1);
  const rows = samples.length;
  const cols = samples[0]?.length ?? 0;
  const cells: Bit[][] = [];
  const confidence: number[][] = [];
  const doubtful: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    const row = rows - 1 - r; // photo top row is the highest chart row
    cells[row] = [];
    confidence[row] = [];
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const a = Math.sqrt(d2(pts[i]!, c0));
      const b = Math.sqrt(d2(pts[i]!, c1));
      const sure = Math.abs(a - b) / (a + b || 1);
      cells[row]![c] = ((labels[i]! === 1) !== flip ? 1 : 0) as Bit;
      confidence[row]![c] = sure;
      if (sure < doubt) doubtful.push([row, c]);
    }
  }
  return { cells, confidence, doubtful };
}

const meanL = (s: CellSample[], labels: number[], g: number) => {
  const m = s.filter((_, i) => labels[i] === g);
  return m.reduce((t, x) => t + x.lab[0], 0) / (m.length || 1);
};

/**
 * Nudge each tapped corner, a fraction of a cell at a time, to where the cells split most cleanly into
 * two groups. Taps are rarely exact, and a shape reading needs the grid to sit on the stitches.
 */
export function refineQuad(img: RGBAImage, quad: Quad, cols: number, rows: number, feature: Feature, rounds = 3): Quad {
  const score = (q: Quad) => {
    const c = classify(sampleCells(img, q, cols, rows), feature).confidence.flat();
    return c.reduce((t, x) => t + x, 0) / c.length;
  };
  let best = quad.map((p) => [...p] as [number, number]) as Quad;
  let bestScore = score(best);
  const cell = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]) / cols;
  for (let round = 0; round < rounds; round++) {
    const step = (cell / 3) / (round + 1);
    for (let k = 0; k < 4; k++)
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
        const q = best.map((p) => [...p] as [number, number]) as Quad;
        q[k] = [q[k]![0] + dx! * step, q[k]![1] + dy! * step];
        const sc = score(q);
        if (sc > bestScore) (best = q), (bestScore = sc);
      }
  }
  return best;
}

/** The whole reading: optionally settle the corners, then sample and classify. */
export function readPhoto(img: RGBAImage, quad: Quad, cols: number, rows: number, feature: Feature, refine = false): PhotoRead {
  const q = refine ? refineQuad(img, quad, cols, rows, feature) : quad;
  return classify(sampleCells(img, q, cols, rows), feature);
}
