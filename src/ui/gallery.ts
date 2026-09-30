// The gallery: real pieces knitted from lab patterns, listed in
// src/content/gallery.json (format in content/README.md). Until pieces
// arrive, the wall shows empty frames with swatches still on the needles.

import { h } from "./h";
import data from "../content/gallery.json";
import { createProject, type ProjectSettings } from "../engine/project";
import { fabricSvg } from "../engine/fabric";

export interface Piece {
  /** Plate number and address: gallery.html#plate-01. */
  plate: string;
  title: string;
  /** When it came off the needles, e.g. 2026-10. */
  date: string;
  /** Picture in public/gallery/, e.g. "gallery/red-scarf.jpg". */
  image: string;
  /** Words describing the picture, for screen readers. */
  alt: string;
  /** How it was made: carrier, alphabet, yarn. */
  made: string;
  /** What it says, folded away so visitors can try reading it first. Optional. */
  message?: string;
  notes?: string;
}

export const PIECES = data as Piece[];

/** A small five-bit swatch, only partly knitted: the rows above `knitted` are still to come. */
function swatch(message: string, seed: number, knitted: number): HTMLElement {
  const settings: ProjectSettings = {
    title: message,
    message,
    layout: { width: 10, border: false },
    construction: { method: "flat", firstRow: "RS" },
    encoding: { alphabet: "fivebit", errorControl: { code: "plain", separator: false, checksum: false } },
    carrier: { id: "purl-relief" },
  };
  const chart = createProject(settings, `gallery-${seed}`).output.chart.slice(0, knitted);
  const el = h("div.plate-swatch");
  el.innerHTML = fabricSvg(chart, { seed, stitch: 24, wobble: 0.6, label: `A drawing of a small swatch still on the needle, ${knitted} rows knitted.` }); // our own SVG
  const svg = el.querySelector("svg")!;
  // The needle across the live stitches at the top.
  const w = Number(svg.getAttribute("width"));
  const needle = document.createElementNS("http://www.w3.org/2000/svg", "g");
  needle.innerHTML = `<line x1="4" y1="14" x2="${w - 4}" y2="14" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="${w - 6}" cy="14" r="6" fill="var(--red)"/>`;
  svg.append(needle);
  return el;
}

// Placeholder plates: swatches from the lab, knitted only in drawing. Grade X, made here.
const WAITING = [
  { plate: "01", title: "On the needles", message: "SOON", rows: 3, note: "Cast on, three rows in. The message will be finished when the piece is." },
  { plate: "02", title: "A swatch for every carrier", message: "WOOL", rows: 2, note: "Purl relief, colours, cables, lace and bobbles, knitted to check how each one reads in real yarn." },
  { plate: "03", title: "Frame reserved", message: "HELLO", rows: 1, note: "Knitted something from a lab pattern? This wall has room." },
];

export function mountGallery(root: HTMLElement): void {
  const real = PIECES.map((p) =>
    h(
      "figure.plate",
      { id: `plate-${p.plate}` },
      h("div.plate-frame", {}, h("img", { src: `${import.meta.env.BASE_URL}${p.image}`, alt: p.alt, loading: "lazy" })),
      h(
        "figcaption",
        {},
        h("p.mono.plate-no", {}, `PLATE ${p.plate} / ${p.date}`),
        h("h2.plate-title", {}, p.title),
        h("p.hint", {}, p.made),
        p.notes ? h("p", {}, p.notes) : "",
        p.message ? h("details.more", {}, h("summary.mono", {}, "WHAT DOES IT SAY?"), h("p.mono.big", {}, p.message)) : "",
      ),
    ),
  );
  const waiting = WAITING.slice(0, Math.max(1, WAITING.length - PIECES.length)).map((w, i) =>
    h(
      "figure.plate.plate-waiting",
      {},
      h("div.plate-frame", {}, swatch(w.message, 11 + i, w.rows)),
      h(
        "figcaption",
        {},
        h("p.mono.plate-no", {}, `PLATE ${String(PIECES.length + i + 1).padStart(2, "0")} / NOT YET HUNG`),
        h("h2.plate-title", {}, w.title),
        h("p", {}, w.note),
        h("p.hint", {}, h("span.badge.badge-x", {}, "X"), " A drawing, not a photograph. The rows so far are real five-bit code: the finished piece will spell a word."),
      ),
    ),
  );
  root.append(
    h("div.gallery-wall", {}, ...real, ...waiting),
    h("p.note", {}, "Every piece here was knitted from a pattern made in ", h("a", { href: "./lab.html" }, "the lab"), ". To read one yourself, copy its stitches into ", h("a", { href: "./decode.html" }, "the decoder"), "."),
  );
}
