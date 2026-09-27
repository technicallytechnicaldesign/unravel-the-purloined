import { describe, expect, it } from "vitest";
import { classify, homography, lab, project, readPhoto, sampleCells, type Quad, type RGBAImage } from "../src/engine/photo";
import { rng } from "../src/engine/fabric";
import { type Bit } from "../src/engine/fivebit";

/** Paint a grid (row 0 at the bottom) into a photo through a perspective, with light falling off to one side and noise. */
function photo(grid: Bit[][], quad: Quad, opts: { w?: number; h?: number; light?: number; noise?: number; paint?: (b: Bit, u: number, v: number) => [number, number, number] } = {}): RGBAImage {
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
      const rgb = inside ? paint(grid[rows - 1 - Math.floor(v)]![Math.floor(u)]!, u % 1, v % 1) : [90, 90, 90];
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
});
