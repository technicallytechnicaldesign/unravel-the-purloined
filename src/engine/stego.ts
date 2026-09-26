// Steganography (packet sections 21, 27.12; tasks S1, S2, T16): hide that a
// message is there at all. Steganography hides existence, not meaning: anyone
// who knows where to look can read it, so a cipher on top is the layered
// model the packet describes. None of this is modern security.
//
// Two ways to hide:
//   scatter  message cells sprinkled over a filler along a route set by a seed;
//            every other cell is filler (T16: the filler is part of the key).
//   motif    each cell of the ordinary message grid becomes a small motif tile
//            (see motifs.ts); readable by eye once you know the motif.

import { type Bit } from "./fivebit";
import { rng } from "./fabric";
import { PATTERNS, type StitchPattern } from "./stitches";
import { type CarrierId } from "./carrier";
import { type MotifId } from "./motifs";

export type FillerId = "texture" | StitchPattern;

export type HideSettings =
  | { mode: "scatter"; seed: number; filler: FillerId; density: 2 | 3 | 4 }
  | { mode: "motif"; motif: MotifId };

export const FILLER_TEXTURE = "Random texture (hides best)";
export const DENSITY_TEXT: Record<2 | 3 | 4, string> = { 2: "1 cell in 2 carries the message", 3: "1 cell in 3", 4: "1 cell in 4" };

/**
 * Sixteen fixed cells at the start of every scattered message. The route
 * gives no marker row, and alphabets without their own checks (Morse, Bacon)
 * can read as tidy nonsense the wrong way up, so the decoder finds the right
 * turn by looking for this pattern. It differs from itself turned, mirrored
 * and inverted.
 */
export const SYNC: Bit[] = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 1];

/** The first `count` cells of a seeded shuffle of all `total` cells: the route. */
export function scatterRoute(seed: number, count: number, total: number): number[] {
  if (count > total) throw new Error(`The message needs ${count} cells but the fabric has only ${total}.`);
  const r = rng(seed ^ 0x51ed270b);
  const cells = Array.from({ length: total }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(r() * (total - i));
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  return cells.slice(0, count);
}

/** Rows needed so that about 1 cell in `density` carries the message. */
export const scatterHeight = (length: number, width: number, density: number): number => Math.max(3, Math.ceil((length * density) / width));

/** Filler value for a cell: a seeded coin toss, or a stitch pattern read as bits (purl or colour B is 1). */
function fillerBit(filler: FillerId, r: number, c: number, texture: () => number): Bit {
  if (filler === "texture") return texture() < 0.5 ? 0 : 1;
  const v = PATTERNS[filler].cell(r, c);
  return v === "purl" || v === "B" ? 1 : 0;
}

/** Build the hidden canvas: filler everywhere, message cells along the route. Row 0 is the bottom. */
export function scatterCanvas(stream: readonly Bit[], width: number, height: number, seed: number, filler: FillerId, carrier: CarrierId): { cells: Bit[][]; carries: boolean[][] } {
  if (filler !== "texture" && PATTERNS[filler].carrier !== carrier) {
    throw new Error(`${PATTERNS[filler].name} is for ${PATTERNS[filler].carrier === "two-colour" ? "two-colour" : "knit and purl"} work; choose another filler for this carrier.`);
  }
  const texture = rng(seed ^ 0x2545f491);
  const cells = Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => fillerBit(filler, r, c, texture)));
  const carries = Array.from({ length: height }, () => new Array<boolean>(width).fill(false));
  scatterRoute(seed, stream.length, width * height).forEach((pos, i) => {
    const [r, c] = [Math.floor(pos / width), pos % width];
    cells[r]![c] = stream[i]!;
    carries[r]![c] = true;
  });
  return { cells, carries };
}

/** Read the message cells back off an upright canvas, in route order. */
export function readScatter(canvas: readonly (readonly Bit[])[], seed: number, length: number): Bit[] {
  const width = canvas[0]?.length ?? 0;
  return scatterRoute(seed, length, width * canvas.length).map((pos) => canvas[Math.floor(pos / width)]![pos % width]!);
}
