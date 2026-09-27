import { describe, expect, it } from "vitest";
import { classify, findFrame, homography, lab, project, readPhoto, sampleCells, type Quad, type RGBAImage } from "../src/engine/photo";
import { rng } from "../src/engine/fabric";
import { type Bit } from "../src/engine/fivebit";

/** Paint a grid (row 0 at the bottom) into a photo through a perspective, with light falling off to one side and noise. */
function photo(grid: Bit[][], quad: Quad, opts: { w?: number; h?: number; light?: number; noise?: number; paint?: (b: Bit, u: number, v: number, row: number, col: number) => [number, number, number] } = {}): RGBAImage {
  const w = opts.w ?? 320;
  const h = opts.h ?? 240;
  const rows = grid.length;
  const cols = grid[0]!.length;
  const back = homography(quad, [[0, 0], [cols, 0], [cols, rows], [0, rows]]);
  const r = rng(7);
  const data = new Uint8ClampedArray(w * h * 4);
  const paint = opts.paint ?? ((b) => (b ? [200, 32, 30] : [245, 238, 225]));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [u, v] = project(back, [x + 0.5, y + 0.5]);
      const inside = u >= 0 && u < cols && v >= 0 && v < rows;
      const rgb = inside ? paint(grid[rows - 1 - Math.floor(v)]![Math.floor(u)]!, u % 1, v % 1, rows - 1 - Math.floor(v), Math.floor(u)) : [90, 90, 90];
      const shade = 1 - (opts.light ?? 0) * (x / w);
      for (let k = 0; k < 3; k++) data[(y * w + x) * 4 + k] = rgb[k]! * shade + ((r() - 0.5) * 2 * (opts.noise ?? 0));
      data[(y * w + x) * 4 + 3] = 255;
    }
  return { width: w, height: h, data };
}

const pattern = (rows: number, cols: number, seed = 3): Bit[][] => {
  const r = rng(seed);
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => (r() < 0.5 ? 1 : 0) as Bit));
};

const tilted: Quad = [[40, 30], [290, 50], [270, 220], [60, 200]];

describe("photo reading", () => {
  it("maps the four corners exactly", () => {
    const H = homography([[0, 0], [1, 0], [1, 1], [0, 1]], tilted);
    tilted.forEach((p, i) => {
      const unit: Quad = [[0, 0], [1, 0], [1, 1], [0, 1]];
      const q = project(H, unit[i]!);
      expect(q[0]).toBeCloseTo(p[0], 6);
      expect(q[1]).toBeCloseTo(p[1], 6);
    });
    expect(() => homography([[0, 0], [1, 1], [2, 2], [3, 3]], tilted)).toThrow(/one line/);
  });

  it("converts colours to Lab", () => {
    expect(lab([255, 255, 255])[0]).toBeCloseTo(100, 0);
    expect(lab([0, 0, 0])[0]).toBeCloseTo(0, 5);
  });

  it("reads a tilted two-colour grid with uneven light and noise, darker colour as 1", () => {
    const grid = pattern(12, 16);
    const r = readPhoto(photo(grid, tilted, { light: 0.45, noise: 25 }), tilted, 16, 12, "hue");
    expect(r.cells).toEqual(grid);
    expect(r.doubtful).toEqual([]);
  });

  it("flags the cells it is unsure of instead of hiding them", () => {
    const grid = pattern(6, 8);
    const mid: [number, number, number] = [222, 135, 128]; // halfway between the yarns
    const s = sampleCells(photo(grid, tilted), tilted, 8, 6);
    // One cell comes out in the halfway colour, as a shadow or a stray fibre might make it.
    s[2]![3] = { ...s[2]![3]!, lab: lab(mid) };
    const r = classify(s, "hue");
    expect(r.doubtful).toContainEqual([6 - 1 - 2, 3]);
  });

  it("tells stripes across from stripes standing up (the knit and purl idea)", () => {
    const grid = pattern(8, 10, 5);
    const img = photo(grid, tilted, {
      noise: 10,
      paint: (b, u, v) => ((b ? Math.floor(v * 4) : Math.floor(u * 4)) % 2 ? [60, 60, 60] : [220, 220, 220]),
    });
    expect(readPhoto(img, tilted, 10, 8, "texture").cells).toEqual(grid);
    expect(readPhoto(img, tilted, 10, 8, "edges").cells).toEqual(grid);
  });

  it("settles sloppy corner taps back onto the grid", () => {
    const grid = pattern(10, 12, 9);
    const img = photo(grid, tilted, { noise: 10 });
    const sloppy = tilted.map(([x, y], i) => [x + (i % 2 ? 11 : -10), y + (i < 2 ? 10 : -11)]) as Quad;
    const plain = readPhoto(img, sloppy, 12, 10, "hue");
    const settled = readPhoto(img, sloppy, 12, 10, "hue", true);
    expect(plain.cells).not.toEqual(grid);
    expect(settled.cells).toEqual(grid);
  });

  it("finds a knitted frame by itself and reads what it holds", () => {
    const inner = pattern(8, 12, 11);
    const framed: Bit[][] = Array.from({ length: 12 }, (_, r) => Array.from({ length: 16 }, (_, c) => (r < 2 || r > 9 || c < 2 || c > 13 ? 1 : inner[r - 2]![c - 2]!)) as Bit[]);
    const img = photo(framed, tilted, { light: 0.3, noise: 12 });
    const f = findFrame(img);
    if (!f.ok) throw new Error(f.message);
    f.quad.forEach((p, i) => {
      expect(Math.abs(p[0] - tilted[i]![0])).toBeLessThan(4);
      expect(Math.abs(p[1] - tilted[i]![1])).toBeLessThan(4);
    });
    expect(readPhoto(img, f.quad, 16, 12, "hue", true).cells).toEqual(framed);
  });

  it("reads lace held to the light: a glowing eyelet is 1", () => {
    const grid = pattern(6, 8, 13);
    const img = photo(grid, tilted, { noise: 8, paint: (b, u, v) => (b && Math.hypot(u - 0.5, v - 0.5) < 0.25 ? [250, 248, 240] : [150, 140, 130]) });
    expect(readPhoto(img, tilted, 8, 6, "light").cells).toEqual(grid);
  });

  it("finds a knit/purl piece framed in a second yarn, in uneven light", () => {
    const inner = pattern(8, 12, 17);
    const framed: Bit[][] = Array.from({ length: 12 }, (_, r) => Array.from({ length: 16 }, (_, c) => (r < 2 || r > 9 || c < 2 || c > 13 ? 1 : inner[r - 2]![c - 2]!)) as Bit[]);
    // One pale yarn with knit and purl textures inside, a red frame around it.
    const img = photo(framed, tilted, {
      light: 0.4,
      noise: 10,
      paint: (b, u, v, r, c) => (r < 2 || r > 9 || c < 2 || c > 13 ? [180, 40, 35] : (b ? Math.floor(v * 4) : Math.floor(u * 4)) % 2 ? [190, 185, 170] : [235, 230, 215]),
    });
    const f = findFrame(img);
    if (!f.ok) throw new Error(f.message);
    f.quad.forEach((p, i) => expect(Math.hypot(p[0] - tilted[i]![0], p[1] - tilted[i]![1])).toBeLessThan(5));
    // Corners a third of a stitch off, settled on the frame, then only the inside is read.
    const off = tilted.map(([x, y], i) => [x + (i % 3 ? 5 : -4), y + (i < 2 ? -5 : 4)]) as Quad;
    const r = readPhoto(img, off, 16, 12, "edges", true, 2);
    expect(r.cells.slice(2, 10).map((row) => row.slice(2, 14))).toEqual(inner);
  });

  it("says so when there is nothing to find", () => {
    const empty: RGBAImage = { width: 200, height: 150, data: new Uint8ClampedArray(200 * 150 * 4).map((_, i) => (i % 4 === 3 ? 255 : 90 + ((i * 7919) % 13))) };
    expect(findFrame(empty)).toMatchObject({ ok: false, message: /No frame/ });
  });
});
