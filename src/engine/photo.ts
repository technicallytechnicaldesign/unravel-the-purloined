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

/**
 * What to compare. colour: the two yarns. hue: the yarns without lightness, steadier under uneven
 * light. light: lightness only, for lace held against a window, where eyelets glow. texture, edges,
 * shape: knit against purl (or plain blocks against cables and bobbles), see the research notes.
 */
export type Feature = "colour" | "hue" | "light" | "texture" | "edges" | "shape";

/** The numbers each kind of reading compares. "hue" drops lightness, which shadows and uneven light disturb most. */
const featureOf = (s: CellSample, f: Feature): number[] =>
  f === "light" ? [s.lab[0]] : f === "texture" ? [s.across] : f === "edges" ? s.edges : f === "shape" ? s.patch : f === "hue" ? [s.lab[1], s.lab[2]] : [s.lab[0], s.lab[1], s.lab[2]];

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
  // Group 1 is the darker colour, the brighter cell against the light (an eyelet), or the texture with more edges across.
  const across = (g: number) => flat.filter((_, i) => labels[i] === g).reduce((t, x) => t + x.across, 0) / (labels.filter((l) => l === g).length || 1);
  const flip = feature === "texture" || feature === "edges" || feature === "shape" ? across(0) > across(1) : feature === "light" ? meanL(flat, labels, 0) > meanL(flat, labels, 1) : meanL(flat, labels, 0) < meanL(flat, labels, 1);
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

export type FrameResult = { ok: true; quad: Quad; note: string } | { ok: false; message: string };

/**
 * Find a knitted frame (a border in the darker yarn, colour B) without taps. The middle of the
 * photo is taken to be fabric: its colours split into the two yarns, and every pixel nearer the
 * darker yarn is marked. The biggest joined patch of marked pixels is the frame (with any message
 * stitches that touch it); its farthest points towards each corner are the corners of the piece.
 * Works while the piece is turned less than about 45 degrees in the photo.
 */
export function findFrame(img: RGBAImage): FrameResult {
  // Work on a small copy: at most 240 pixels across.
  const step = Math.max(1, Math.ceil(Math.max(img.width, img.height) / 240));
  const W = Math.floor(img.width / step);
  const H = Math.floor(img.height / step);
  const colours: [number, number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) colours.push(lab(pixel(img, x * step, y * step)));
  const middle = colours.filter((_, i) => {
    const x = i % W, y = Math.floor(i / W);
    return x > W / 4 && x < (3 * W) / 4 && y > H / 4 && y < (3 * H) / 4;
  });
  const split = classify([middle.map((lab) => ({ lab, across: 0, edges: [], patch: [] }))], "colour", 0);
  const mean = (b: 0 | 1) => {
    const m = middle.filter((_, i) => split.cells[0]![i] === b);
    return m.length ? ([0, 1, 2].map((k) => m.reduce((t, c) => t + c[k]!, 0) / m.length) as [number, number, number]) : undefined;
  };
  const dark = mean(1);
  const light = mean(0);
  if (!dark || !light) return { ok: false, message: "The middle of the photo is all one colour, so no frame colour can be told apart. Tap the corners instead." };
  const d2 = (a: number[], b: number[]) => a.reduce((t, x, k) => t + (x - b[k]!) ** 2, 0);
  const gap = Math.sqrt(d2(dark, light));
  const mark = colours.map((c) => d2(c, dark) < d2(c, light) && Math.sqrt(d2(c, dark)) < gap * 0.6);

  // Largest 4-connected patch of marked pixels.
  const seen = new Uint8Array(W * H);
  let best: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!mark[i] || seen[i]) continue;
    const patch: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop()!;
      patch.push(j);
      const x = j % W, y = Math.floor(j / W);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const)
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) {
          const k = ny * W + nx;
          if (mark[k] && !seen[k]) (seen[k] = 1), stack.push(k);
        }
    }
    if (patch.length > best.length) best = patch;
  }
  if (best.length < (W * H) / 200) return { ok: false, message: "No frame found: nothing in the darker yarn is big enough. Tap the corners instead." };
  const pts = best.map((j): Point => [(j % W) * step + step / 2, Math.floor(j / W) * step + step / 2]);
  const touches = best.some((j) => { const x = j % W, y = Math.floor(j / W); return x === 0 || y === 0 || x === W - 1 || y === H - 1; });
  if (touches) return { ok: false, message: "The darker yarn runs off the edge of the photo, so the frame cannot be told from the background. Leave some space around the piece, or tap the corners." };
  const by = (f: (p: Point) => number, max: boolean) => pts.reduce((a, p) => ((max ? f(p) > f(a) : f(p) < f(a)) ? p : a));
  const quad: Quad = [by(([x, y]) => x + y, false), by(([x, y]) => x - y, true), by(([x, y]) => x + y, true), by(([x, y]) => x - y, false)];
  // Pixel centres sit half a sample inside the true edge: push each corner outwards by that much.
  const cx = quad.reduce((t, p) => t + p[0], 0) / 4, cy = quad.reduce((t, p) => t + p[1], 0) / 4;
  const out = quad.map(([x, y]): Point => [x + Math.sign(x - cx) * step / 2, y + Math.sign(y - cy) * step / 2]) as Quad;
  return { ok: true, quad: out, note: "Frame found. Check the corner marks sit on the outer corners of the frame; drag any that do not." };
}
