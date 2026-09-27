// Phase 8 research: how well does the photo reader cope with drawn fabric
// photographed badly? Renders patterns with the game's fabric renderer,
// rasterizes them in Chromium, "photographs" them (tilt, uneven light, noise,
// blur, JPEG, sloppy corner taps), reads them back and decodes.
//
// Run: npm i --no-save playwright && npx vite-node scripts/photo-experiment.ts
// (or PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs to use another copy).
// Drawn fabric is not yarn: results say what the geometry and maths can do,
// not how a real photo of a real swatch behaves.

import { createProject, type ProjectSettings } from "../src/engine/project";
import { fabricSvg, rng } from "../src/engine/fabric";
import { homography, project, pixel, readPhoto, type Feature, type Quad, type RGBAImage } from "../src/engine/photo";
import { decodeCells } from "../src/engine/steps";
import { DEFAULT_OPTIONS, type SymbolCode } from "../src/engine/errorcontrol";

interface Shot { tilt: number; light: number; noise: number; blur: number; jpeg: number; tap: number; wobble: number }
const BASE: Shot = { tilt: 0.15, light: 0.3, noise: 8, blur: 1, jpeg: 0.8, tap: 2, wobble: 0.5 };

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
const page = await browser.newPage();

/** SVG to RGBA pixels, in the browser. */
async function rasterize(svg: string): Promise<RGBAImage> {
  const r = await page.evaluate(async (s: string) => {
    const img = new Image();
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(s)));
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let bin = "";
    for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode(...d.subarray(i, i + 0x8000));
    return { width: c.width, height: c.height, data: btoa(bin) };
  }, svg);
  return { width: r.width, height: r.height, data: new Uint8ClampedArray(Buffer.from(r.data, "base64")) };
}

/** Round-trip pixels through JPEG at a quality, in the browser. */
async function jpeg(img: RGBAImage, q: number): Promise<RGBAImage> {
  const r = await page.evaluate(async ({ w, h, data, q }: { w: number; h: number; data: string; q: number }) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    g.putImageData(new ImageData(Uint8ClampedArray.from(atob(data), (ch) => ch.charCodeAt(0)), w, h), 0, 0);
    const img = new Image();
    img.src = c.toDataURL("image/jpeg", q);
    await img.decode();
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    let bin = "";
    for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode(...d.subarray(i, i + 0x8000));
    return btoa(bin);
  }, { w: img.width, h: img.height, data: Buffer.from(img.data).toString("base64"), q });
  return { ...img, data: new Uint8ClampedArray(Buffer.from(r, "base64")) };
}

/** Place the fabric in a 900 x 700 photo through a perspective, then light, blur and noise it. */
function shoot(src: RGBAImage, s: Shot, seed: number): { img: RGBAImage; toPhoto: (p: [number, number]) => [number, number] } {
  const W = 900, H = 700;
  const r = rng(seed);
  const t = s.tilt;
  const quad: Quad = [[80 + 300 * t * r(), 60 + 200 * t * r()], [820 - 300 * t * r(), 60 + 120 * t * r()], [820 - 150 * t * r(), 640 - 200 * t * r()], [80 + 150 * t * r(), 640 - 120 * t * r()]];
  const srcQuad: Quad = [[0, 0], [src.width, 0], [src.width, src.height], [0, src.height]];
  const back = homography(quad, srcQuad);
  const fwd = homography(srcQuad, quad);
  let data = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [u, v] = project(back, [x + 0.5, y + 0.5]);
      const inside = u >= 0 && u < src.width && v >= 0 && v < src.height;
      const rgb = inside ? pixel(src, u - 0.5, v - 0.5) : [70, 66, 60];
      const shade = 1 - s.light * (0.6 * x / W + 0.4 * y / H);
      for (let k = 0; k < 3; k++) data[(y * W + x) * 3 + k] = rgb[k]! * shade;
    }
  for (let pass = 0; pass < s.blur; pass++) data = boxBlur(data, W, H);
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    for (let k = 0; k < 3; k++) out[i * 4 + k] = data[i * 3 + k]! + (r() - 0.5) * 2 * s.noise;
    out[i * 4 + 3] = 255;
  }
  return { img: { width: W, height: H, data: out }, toPhoto: (p) => project(fwd, p) };
}

function boxBlur(d: Float32Array, W: number, H: number): Float32Array {
  const o = new Float32Array(d.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let k = 0; k < 3; k++) {
        let t = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) (t += d[(yy * W + xx) * 3 + k]!), n++;
        }
        o[(y * W + x) * 3 + k] = t / n;
      }
  return o;
}

async function trial(carrier: "two-colour" | "purl-relief", feature: Feature, refine: boolean, code: SymbolCode, s: Shot, seed: number) {
  const settings: ProjectSettings = {
    title: "t",
    message: "MEET AT NOON",
    encoding: { alphabet: "fivebit", errorControl: { ...DEFAULT_OPTIONS, code } },
    layout: { width: 16, border: false, borderWidth: 0 },
    carrier: { id: carrier },
    construction: { method: "flat", firstRow: "RS" },
  };
  const p = createProject(settings, "x");
  const chart = p.output.chart;
  const svg = fabricSvg(chart, { seed, wobble: s.wobble, stitch: 22, colours: carrier === "two-colour" ? { A: "#efe6d2", B: "#b3261e" } : undefined });
  const src = await rasterize(svg);
  const pad = 22 * 0.8;
  const shot = shoot(src, s, seed);
  const img = s.jpeg < 1 ? await jpeg(shot.img, s.jpeg) : shot.img;
  const r = rng(seed * 31);
  const tap = (p: [number, number]): [number, number] => { const q = shot.toPhoto(p); return [q[0] + (r() - 0.5) * 2 * s.tap, q[1] + (r() - 0.5) * 2 * s.tap]; };
  const quad: Quad = [tap([pad, pad]), tap([src.width - pad, pad]), tap([src.width - pad, src.height - pad]), tap([pad, src.height - pad])];
  const cols = chart[0]!.length, rows = chart.length;
  const read = readPhoto(img, quad, cols, rows, feature, refine);
  const truth = p.output.logicalGrid;
  const wrong = (inv: number) => truth.reduce((n, row, i) => n + row.filter((b, j) => (b ^ inv) !== read.cells[i]![j]).length, 0);
  const errors = Math.min(wrong(0), wrong(1));
  const decoded = decodeCells(read.cells, 0, settings.encoding).text;
  return { cells: rows * cols, errors, doubtful: read.doubtful.length, ok: decoded === "MEET AT NOON" };
}

const SEEDS = [1, 2, 3];
const vary: [keyof Shot, number[]][] = [["tilt", [0, 0.3, 0.5]], ["light", [0, 0.6]], ["noise", [0, 30]], ["blur", [0, 3]], ["jpeg", [1, 0.4]], ["tap", [0, 6, 12]], ["wobble", [0, 1]]];
const cases: [string, Shot][] = [["baseline", BASE], ...vary.flatMap(([k, vs]) => vs.map((v): [string, Shot] => [`${k} ${v}`, { ...BASE, [k]: v }])), ["everything bad", { tilt: 0.5, light: 0.6, noise: 30, blur: 3, jpeg: 0.4, tap: 8, wobble: 1 }]];

console.log("| carrier | feature | code | case | cell errors | doubtful | decoded |");
console.log("|---|---|---|---|---|---|---|");
const SETUPS = [["two-colour", "hue", false], ["two-colour", "colour", false], ["two-colour", "hue", true], ["purl-relief", "texture", false], ["purl-relief", "edges", false], ["purl-relief", "edges", true], ["purl-relief", "shape", false], ["purl-relief", "shape", true]] as const;
for (const [carrier, feature, refine] of SETUPS)
  for (const code of ["hamming"] as const)
    for (const [name, s] of cases) {
      let errors = 0, doubtful = 0, ok = 0, cells = 0;
      for (const seed of SEEDS) {
        const t = await trial(carrier, feature, refine, code, s, seed);
        errors += t.errors;
        doubtful += t.doubtful;
        cells += t.cells;
        ok += t.ok ? 1 : 0;
      }
      console.log(`| ${carrier} | ${feature}${refine ? " + settle" : ""} | ${code} | ${name} | ${(100 * errors / cells).toFixed(1)}% | ${(100 * doubtful / cells).toFixed(1)}% | ${ok}/${SEEDS.length} |`);
    }
await browser.close();
