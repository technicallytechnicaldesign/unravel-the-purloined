// Gallery data: real pieces from src/content/gallery.json, plus drawn
// placeholders until they arrive. Shared by the gallery page and the decoder,
// which opens a piece's pattern with a blank grid (decode.html#plate=01).

import data from "./gallery.json";
import { createProject, exportProject, type ProjectSettings } from "../engine/project";

/** Content tags. Unknown tags still show, in the plain style. */
export const TAGS: Record<string, { label: string; tone: "ok" | "care" | "adult" }> = {
  "kid-friendly": { label: "Kid friendly", tone: "ok" },
  swearing: { label: "Contains swearing", tone: "care" },
  nsfw: { label: "NSFW", tone: "adult" },
};

export interface Piece {
  /** Plate number and address: gallery.html#plate-01. */
  plate: string;
  title: string;
  /** When it came off the needles, e.g. 2026-10. */
  date: string;
  /** Who knitted it, and their handle or tag, e.g. "@wooly". Both optional. */
  knitter?: string;
  handle?: string;
  /** Picture in public/gallery/, e.g. "gallery/red-scarf.jpg". */
  image: string;
  /** Words describing the picture, for screen readers. Never the message. */
  alt: string;
  /** How it was made: carrier, alphabet, yarn. */
  made: string;
  /** The project file saved from the lab, in public/gallery/: lets visitors decode it themselves. */
  pattern?: string;
  /** What it says. Hidden until a visitor asks. It is a puzzle, not a secret: it sits in the page source. */
  message?: string;
  tags?: string[];
  notes?: string;
}

export const PIECES = data as Piece[];

const fiveBit = (message: string, width = 10): ProjectSettings => ({
  title: message,
  message,
  layout: { width, border: false },
  construction: { method: "flat", firstRow: "RS" },
  encoding: { alphabet: "fivebit", errorControl: { code: "plain", separator: false, checksum: false } },
  carrier: { id: "purl-relief" },
});

/** Drawn stand-ins until real pieces are hung. `rows` knitted so far; all rows means finished. */
export interface Placeholder {
  /** Numbered after the real pieces by `waiting()`. */
  plate: string;
  title: string;
  note: string;
  settings: ProjectSettings;
  rows?: number;
  tags?: string[];
}

export const PLACEHOLDERS: Placeholder[] = [
  { plate: "01", title: "On the needles", note: "Cast on, three rows in. The message will be finished when the piece is.", settings: fiveBit("SOON"), rows: 3 },
  { plate: "02", title: "A swatch for every carrier", note: "Purl relief, colours, cables, lace and bobbles, knitted to check how each one reads in real yarn.", settings: fiveBit("WOOL"), rows: 2 },
  { plate: "03", title: "A sample to try", note: "A finished drawing, so the buttons below have something to work on. Decode it yourself, or reveal it.", settings: fiveBit("HELLO"), tags: ["kid-friendly"] },
];

/** The placeholders still shown: each real piece takes one frame, and at least one stays empty. */
export const waiting = (): Placeholder[] =>
  PLACEHOLDERS.slice(0, Math.max(1, PLACEHOLDERS.length - PIECES.length)).map((p, i) => ({ ...p, plate: String(PIECES.length + i + 1).padStart(2, "0") }));

/** A plate's pattern as project JSON, for the decoder. Undefined when it has none. */
export async function plateProject(plate: string): Promise<string | undefined> {
  const piece = PIECES.find((p) => p.plate === plate);
  if (piece?.pattern) {
    const r = await fetch(`${import.meta.env.BASE_URL}${piece.pattern}`);
    return r.ok ? r.text() : undefined;
  }
  const drawn = !piece && waiting().find((p) => p.plate === plate && !p.rows);
  return drawn ? exportProject(createProject(drawn.settings, `gallery-${plate}`)) : undefined;
}
