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
export function refineQuad(img: RGBAImage, quad: Quad, cols: number, rows: number, feature: Feature, rounds = 3, border = 0): Quad {
  // Knit/purl with a frame: align on the frame, where every border cell should be frame yarn and
  // the ring just inside should not. Otherwise align on how cleanly the message cells split in two
  // (in colourwork the frame's yarn is also a message colour, so the frame says less).
  const framed = border > 0 && rows > 2 * border + 1 && cols > 2 * border + 1 && feature !== "colour" && feature !== "hue";
  const score = (q: Quad) => (framed ? frameFit(sampleCells(img, q, cols, rows), border) : meanConfidence(classifyInside(sampleCells(img, q, cols, rows), feature, border)));
  let best = quad.map((p) => [...p] as [number, number]) as Quad;
  let bestScore = score(best);
  const cell = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]) / cols;
  const passes = framed ? rounds + 2 : rounds;
  for (let round = 0; round < passes; round++) {
    const step = cell / 3 / (round + 1);
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

const meanConfidence = (r: PhotoRead) => {
  const c = r.confidence.flat();
  return c.reduce((t, x) => t + x, 0) / c.length;
};

/** How well a grid sits on a frame: the ring inside far from the frame's colour, the frame cells close to it. */
function frameFit(samples: CellSample[][], border: number): number {
  const rows = samples.length, cols = samples[0]!.length;
  const inFrame: CellSample[] = [], inside: CellSample[] = [];
  samples.forEach((row, r) => row.forEach((s, c) => {
    const depth = Math.min(r, c, rows - 1 - r, cols - 1 - c);
    if (depth < border) inFrame.push(s);
    else if (depth === border) inside.push(s);
  }));
  const median = [0, 1, 2].map((k) => [...inFrame.map((s) => s.lab[k]!)].sort((a, b) => a - b)[inFrame.length >> 1]!);
  const dist = (s: CellSample) => Math.hypot(s.lab[0] * 0.5 - median[0]! * 0.5, s.lab[1] - median[1]!, s.lab[2] - median[2]!);
  const mean = (list: CellSample[]) => list.reduce((t, s) => t + dist(s), 0) / (list.length || 1);
  return mean(inside) - mean(inFrame);
}

/** The whole reading: optionally settle the corners, then sample and classify. */
export function readPhoto(img: RGBAImage, quad: Quad, cols: number, rows: number, feature: Feature, refine = false, border = 0): PhotoRead {
  const q = refine ? refineQuad(img, quad, cols, rows, feature, 3, border) : quad;
  return classifyInside(sampleCells(img, q, cols, rows), feature, border);
}

/**
 * Classify only the cells inside a border `border` cells deep. A frame is not message, and in a
 * different yarn or stitch it would pull the two groups apart. Border cells come back as 0, sure.
 */
function classifyInside(samples: CellSample[][], feature: Feature, border: number): PhotoRead {
  const rows = samples.length, cols = samples[0]?.length ?? 0;
  if (!border || rows <= 2 * border || cols <= 2 * border) return classify(samples, feature);
  const inner = classify(samples.slice(border, rows - border).map((r) => r.slice(border, cols - border)), feature);
  const cells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (inner.cells[r - border]?.[c - border] ?? 0) as Bit));
  const confidence = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => inner.confidence[r - border]?.[c - border] ?? 1));
  return { cells, confidence, doubtful: inner.doubtful.map(([r, c]): [number, number] => [r + border, c + border]) };
}

export type FrameResult = { ok: true; quad: Quad; note: string } | { ok: false; message: string };

/**
 * Find a knitted frame (a border in its own yarn) without taps. The photo's colours are split into
 * four groups; in each group, every joined patch that stays clear of the photo's edges is a
 * candidate, and the one whose corners enclose the most wins: the outermost ring of the piece,
 * whatever its colour. A plain piece on a contrasting table is its own frame, so its outline wins.
 * The farthest points towards each corner are the corners of the piece.
 * Works while the piece is turned less than about 45 degrees in the photo.
 */
export function findFrame(img: RGBAImage): FrameResult {
  // Work on a small copy: at most 240 pixels across.
  const step = Math.max(1, Math.ceil(Math.max(img.width, img.height) / 240));
  const W = Math.floor(img.width / step);
  const H = Math.floor(img.height / step);
  const colours: number[][] = [];
  // Shade scales all three channels together, so each channel's share of the total stays put:
  // one yarn stays one group from the lit side to the shadowed side. A gentle log-brightness
  // term still tells a grey table from cream yarn.
  // Each sample averages a block of pixels, which also calms the grain of a photo.
  const block = Math.max(step, 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < block; dy++)
        for (let dx = 0; dx < block; dx++) {
          const [pr, pg, pb] = pixel(img, x * step + dx - (block - step) / 2, y * step + dy - (block - step) / 2);
          (r += pr), (g += pg), (b += pb);
        }
      const sum = r + g + b + block * block;
      colours.push([(300 * r) / sum, (300 * g) / sum, 20 * Math.log(sum / (block * block))]);
    }
  const d2 = (a: number[], b: number[]) => a.reduce((t, x, k) => t + (x - b[k]!) ** 2, 0);

  // 4-means, started from points spread far apart.
  const centres: number[][] = [colours[0]!];
  while (centres.length < 4) centres.push(colours.reduce((best, c) => (Math.min(...centres.map((m) => d2(c, m))) > Math.min(...centres.map((m) => d2(best, m))) ? c : best)));
  let group = new Uint8Array(colours.length);
  for (let it = 0; it < 12; it++) {
    group = Uint8Array.from(colours, (c) => centres.reduce((bi, m, i) => (d2(c, m) < d2(c, centres[bi]!) ? i : bi), 0));
    centres.forEach((_, g) => {
      const m = colours.filter((_, i) => group[i] === g);
      if (m.length) centres[g] = [0, 1, 2].map((k) => m.reduce((t, c) => t + c[k]!, 0) / m.length);
    });
  }

  let best: { quad: Quad; area: number } | undefined;
  let edgeOnly = false;
  for (let g = 0; g < 4; g++) {
    // Bridge the dark gaps between stitches: grow the group by two samples before joining pixels
    // into patches, but trace the sides from the group's own pixels only.
    const own = Uint8Array.from(group, (v) => (v === g ? 1 : 0));
    const grown = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (!own[i]) continue;
      const x = i % W, y = Math.floor(i / W);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) grown[ny * W + nx] = 1;
      }
    }
    const seen = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (!own[i] || seen[i]) continue;
      const patch: number[] = [];
      const stack = [i];
      seen[i] = 1;
      let touches = false;
      while (stack.length) {
        const j = stack.pop()!;
        if (own[j]) patch.push(j);
        const x = j % W, y = Math.floor(j / W);
        if (own[j] && (x === 0 || y === 0 || x === W - 1 || y === H - 1)) touches = true;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const)
          if (nx >= 0 && ny >= 0 && nx < W && ny < H) {
            const k = ny * W + nx;
            if (grown[k] && !seen[k]) (seen[k] = 1), stack.push(k);
          }
      }
      if (patch.length < (W * H) / 200) continue;
      if (touches) {
        edgeOnly = true;
        continue;
      }
      const quad = fitSides(patch, W, step);
      if (!quad) continue;
      const area = Math.abs(quad.reduce((t, [x, y], k) => { const [nx, ny] = quad[(k + 1) % 4]!; return t + x * ny - nx * y; }, 0)) / 2;
      if (!best || area > best.area) best = { quad, area };
    }
  }
  if (!best || best.area < (img.width * img.height) / 50)
    return { ok: false, message: edgeOnly ? "No frame found clear of the photo's edges. Leave some table showing around the piece, or tap the corners." : "No frame found. Tap the corners instead." };
  return { ok: true, quad: best.quad, note: "Frame found. Check the corner marks sit on the outer corners of the frame; drag any that do not." };
}

/**
 * The four sides of a patch as straight lines, met at the corners. Each side is traced (the topmost
 * pixel of the patch in each column along the top, and so on), trimmed to its middle, and fitted by
 * least squares after dropping the points farthest from a first fit: stitches are bumpy, and one
 * rounded corner stitch should not decide where the corner is.
 */
function fitSides(patch: number[], W: number, step: number): Quad | undefined {
  const top = new Map<number, number>(), bottom = new Map<number, number>(), left = new Map<number, number>(), right = new Map<number, number>();
  for (const j of patch) {
    const x = j % W, y = Math.floor(j / W);
    if (!top.has(x) || y < top.get(x)!) top.set(x, y);
    if (!bottom.has(x) || y > bottom.get(x)!) bottom.set(x, y + 1);
    if (!left.has(y) || x < left.get(y)!) left.set(y, x);
    if (!right.has(y) || x > right.get(y)!) right.set(y, x + 1);
  }
  // Fit v = a u + b to the middle 60% of a traced side, twice, the second time without the worst quarter.
  const fit = (side: Map<number, number>): [number, number] | undefined => {
    const us = [...side.keys()].sort((a, b) => a - b);
    if (us.length < 5) return undefined;
    const lo = us[Math.floor(us.length * 0.2)]!, hi = us[Math.ceil(us.length * 0.8) - 1]!;
    let pts = us.filter((u) => u >= lo && u <= hi).map((u) => [u + 0.5, side.get(u)!] as const);
    const ls = (p: readonly (readonly [number, number])[]): [number, number] => {
      const n = p.length, su = p.reduce((t, q) => t + q[0], 0), sv = p.reduce((t, q) => t + q[1], 0);
      const suu = p.reduce((t, q) => t + q[0] * q[0], 0), suv = p.reduce((t, q) => t + q[0] * q[1], 0);
      const a = (n * suv - su * sv) / (n * suu - su * su || 1);
      return [a, (sv - a * su) / n];
    };
    const first = ls(pts);
    pts = [...pts].sort((p, q) => Math.abs(p[1] - first[0] * p[0] - first[1]) - Math.abs(q[1] - first[0] * q[0] - first[1])).slice(0, Math.max(3, Math.ceil(pts.length * 0.75)));
    return ls(pts);
  };
  const t = fit(top), b = fit(bottom), l = fit(left), r = fit(right);
  if (!t || !b || !l || !r) return undefined;
  // top/bottom: y = a x + c; left/right: x = a y + c. Meet them.
  const meet = ([ha, hc]: [number, number], [va, vc]: [number, number]): Point => {
    const y = (ha * vc + hc) / (1 - ha * va);
    return [(va * y + vc) * step, y * step];
  };
  return [meet(t, l), meet(t, r), meet(b, r), meet(b, l)];
}
