// Phase 8.4 and 8.6: read a photo into the decoder's grid. The photo stays in
// this browser. A person places the four corners (or lets the lab find a
// knitted frame), checks the grid drawn over the photo, and gets back a grid
// with the doubtful stitches marked for a second look.

import { h } from "./h";
import { field, select } from "./controls";
import { findFrame, homography, project, readPhoto, type Feature, type Point, type Quad, type RGBAImage } from "../engine/photo";
import { type Bit } from "../engine/fivebit";

const MAX_SIDE = 1600; // larger photos are scaled down: plenty for stitches, kind to phones
const CORNERS = ["top left", "top right", "bottom right", "bottom left"];

export interface PhotoHooks {
  /** Stitches and rows the decoder grid has now. */
  size(): [cols: number, rows: number];
  /** Whether the carrier chosen in the decoder is colourwork. */
  colour(): boolean;
  /** Fill the grid (row 0 at the bottom) and mark the doubtful cells. */
  apply(cells: Bit[][], doubtful: [number, number][]): void;
}

export function photoReader(hooks: PhotoHooks): HTMLElement {
  const file = h("input", { type: "file", accept: "image/*", capture: "environment", "aria-label": "Photo of the knitting" });
  const canvas = h("canvas.photo-canvas", { tabindex: 0, role: "application", "aria-label": "Photo with four corner marks. Choose a corner, then move it with the arrow keys; hold Shift for bigger steps." });
  const lens = h("canvas.photo-lens", { width: 160, height: 160, "aria-hidden": "true" });
  const status = h("p.hint", { role: "status" });
  const stage = h("div.photo-stage", { hidden: true }, h("div.photo-wrap", {}, canvas, lens));
  const cols = h("input", { type: "number", name: "photo-cols", min: 2, max: 60, inputmode: "numeric" });
  const rows = h("input", { type: "number", name: "photo-rows", min: 2, max: 60, inputmode: "numeric" });
  const how = select("photo-corners", [["tap", "I will place the corners"], ["frame", "Find the knitted frame for me"]]);
  const reading = select("photo-reading", [
    ["hue", "Two colours"],
    ["shape", "Knit and purl: careful corners, most exact"],
    ["edges", "Knit and purl: forgiving corners, a few misreads"],
    ["light", "Lace held against a window: eyelets glow"],
    ["colour", "Two colours, lightness included"],
  ]);
  const settle = h("input", { type: "checkbox", name: "photo-settle", checked: true });
  const cornerPick = select("photo-corner", CORNERS.map((c, i) => [String(i), c] as [string, string]));

  let img: RGBAImage | undefined;
  let bitmap: HTMLCanvasElement | undefined;
  let quad: Quad = [[0, 0], [0, 0], [0, 0], [0, 0]];
  let active = 0;
  let dragging = false;

  const defaults = () => {
    const [c, r] = hooks.size();
    cols.value ||= String(c);
    rows.value ||= String(r);
    reading.value = hooks.colour() ? "hue" : "shape";
  };

  /** Draw the photo, the grid it will read and the corner marks. */
  const draw = () => {
    if (!bitmap || !img) return;
    const g = canvas.getContext("2d")!;
    g.drawImage(bitmap, 0, 0);
    const scale = img.width / (canvas.getBoundingClientRect().width || img.width);
    const c = Math.max(1, Math.round(Number(cols.value)) || 1);
    const r = Math.max(1, Math.round(Number(rows.value)) || 1);
    const H = homography([[0, 0], [c, 0], [c, r], [0, r]], quad);
    g.lineWidth = 1.2 * scale;
    g.strokeStyle = "rgba(200, 32, 30, 0.75)";
    g.beginPath();
    for (let i = 0; i <= c; i++) {
      const a = project(H, [i, 0]), b = project(H, [i, r]);
      g.moveTo(...a);
      g.lineTo(...b);
    }
    for (let j = 0; j <= r; j++) {
      const a = project(H, [0, j]), b = project(H, [c, j]);
      g.moveTo(...a);
      g.lineTo(...b);
    }
    g.stroke();
    quad.forEach(([x, y], i) => {
      g.beginPath();
      g.arc(x, y, (i === active ? 11 : 8) * scale, 0, Math.PI * 2);
      g.lineWidth = 3 * scale;
      g.strokeStyle = i === active ? "#c8201e" : "#16140f";
      g.stroke();
      g.fillStyle = "#f3eee2";
      g.font = `${12 * scale}px monospace`;
      g.fillText(String(i + 1), x + 12 * scale, y - 12 * scale);
    });
    drawLens();
  };

  /** A 4x magnifier around the active corner, for placing it on the stitch edge. */
  const drawLens = () => {
    if (!bitmap) return;
    const g = lens.getContext("2d")!;
    const [x, y] = quad[active]!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 160, 160);
    g.drawImage(bitmap, x - 20, y - 20, 40, 40, 0, 0, 160, 160);
    g.strokeStyle = "#c8201e";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(80, 0);
    g.lineTo(80, 160);
    g.moveTo(0, 80);
    g.lineTo(160, 80);
    g.stroke();
  };

  const say = () => (status.textContent = `Corner ${active + 1} (${CORNERS[active]}) at ${Math.round(quad[active]![0])}, ${Math.round(quad[active]![1])}.`);

  const placeCorners = () => {
    if (!img) return;
    if (how.value === "frame") {
      const f = findFrame(img);
      if (f.ok) {
        quad = f.quad;
        status.textContent = f.note;
      } else {
        status.textContent = f.message;
      }
    } else {
      const m = Math.min(img.width, img.height) * 0.15;
      quad = [[m, m], [img.width - m, m], [img.width - m, img.height - m], [m, img.height - m]];
      status.textContent = "Drag each numbered mark onto the outer corner of the grid: 1 top left, 2 top right, 3 bottom right, 4 bottom left, as the fabric lies in the photo.";
    }
    draw();
  };

  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      bitmap = document.createElement("canvas");
      bitmap.width = Math.round(bmp.width * k);
      bitmap.height = Math.round(bmp.height * k);
      bitmap.getContext("2d")!.drawImage(bmp, 0, 0, bitmap.width, bitmap.height);
      const data = bitmap.getContext("2d")!.getImageData(0, 0, bitmap.width, bitmap.height);
      img = { width: data.width, height: data.height, data: data.data };
      canvas.width = img.width;
      canvas.height = img.height;
      stage.hidden = false;
      defaults();
      placeCorners();
    } catch {
      status.textContent = "This file could not be opened as a picture.";
    }
  });

  // Pointer: grab the nearest corner and drag it.
  const at = (ev: PointerEvent): Point => {
    const r = canvas.getBoundingClientRect();
    return [((ev.clientX - r.left) * canvas.width) / r.width, ((ev.clientY - r.top) * canvas.height) / r.height];
  };
  canvas.addEventListener("pointerdown", (ev) => {
    const p = at(ev);
    active = quad.reduce((best, q, i) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(quad[best]![0] - p[0], quad[best]![1] - p[1]) ? i : best), 0);
    cornerPick.value = String(active);
    quad[active] = p;
    dragging = true;
    lens.classList.add("on");
    canvas.setPointerCapture(ev.pointerId);
    draw();
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    quad[active] = at(ev);
    draw();
  });
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    lens.classList.remove("on");
    say();
  };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);

  // Keyboard: arrows move the chosen corner.
  canvas.addEventListener("keydown", (ev) => {
    const d: Record<string, Point> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const v = d[ev.key];
    if (v) {
      ev.preventDefault();
      const k = ev.shiftKey ? 10 : 1;
      quad[active] = [quad[active]![0] + v[0] * k, quad[active]![1] + v[1] * k];
      lens.classList.add("on");
      draw();
      say();
    } else if (/^[1-4]$/.test(ev.key)) {
      active = Number(ev.key) - 1;
      cornerPick.value = String(active);
      draw();
      say();
    }
  });
  canvas.addEventListener("blur", () => lens.classList.remove("on"));
  cornerPick.addEventListener("change", () => ((active = Number(cornerPick.value)), draw(), say(), canvas.focus()));
  how.addEventListener("change", placeCorners);
  for (const el of [cols, rows]) el.addEventListener("input", draw);
  addEventListener("resize", draw);

  const read = () => {
    if (!img) return void (status.textContent = "Open a photo first.");
    const c = Math.round(Number(cols.value));
    const r = Math.round(Number(rows.value));
    if (!(c >= 2 && c <= 60 && r >= 2 && r <= 60)) return void (status.textContent = "Stitches and rows must be whole numbers from 2 to 60.");
    const out = readPhoto(img, quad, c, r, reading.value as Feature, settle.checked);
    hooks.apply(out.cells, out.doubtful);
    status.textContent = `Read ${c * r} cells into the grid below; ${out.doubtful.length ? `${out.doubtful.length} look doubtful and are marked with a dashed outline. Check those against the photo.` : "none look doubtful."} The checks will point at anything that still looks wrong.`;
  };

  return h(
    "details.more",
    {},
    h("summary.mono", {}, "READ FROM A PHOTO"),
    h("p.hint", {}, "The photo stays on this device. Lay the piece flat, right side up, in even light; a photo straight from above reads best."),
    file,
    stage,
    h("div.pair", {}, field("CORNERS", how, "A frame in the darker yarn (the photo frame border in the lab) can be found by itself."), field("MOVE CORNER", cornerPick)),
    h("div.pair", {}, field("STITCHES ACROSS", cols, "Every stitch, border included."), field("ROWS", rows)),
    field("READ AS", reading),
    h("label.check.mono", {}, settle, " Settle the corners onto the stitches"),
    h("div.actions", {}, h("button.btn.btn-go", { type: "button", onclick: read }, "Read the photo")),
    status,
  );
}
