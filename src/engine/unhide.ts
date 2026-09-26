// Reading hidden messages back with a parcel key (tasks S1, S2, S4). The same
// numbered steps as the ordinary decoder, and findings still point at the
// stitches they are about, in the fabric as it was given.

import { type Bit } from "./fivebit";
import { decipher } from "./ciphers";
import { mapCell, transform, unframe, UPRIGHT, describe as describeOrientation, type Cell, type Orientation } from "./grid";
import { MOTIFS, reduce } from "./motifs";
import { readScatter, scatterRoute, SYNC } from "./stego";
import { decodeCells, decodeStream, describeCells, type DecodeSteps, type Finding, type Span } from "./steps";
import { type ParcelKey } from "./key";

export interface UnhideSteps extends DecodeSteps {
  /** The message after the key's cipher, when it has one. */
  deciphered?: string;
}

const ORIENTATIONS: Orientation[] = [false, true].flatMap((rotated180) =>
  [false, true].flatMap((mirrored) => [false, true].map((inverted) => ({ rotated180, mirrored, inverted }))),
);

const withCipher = (s: DecodeSteps, key: ParcelKey): UnhideSteps =>
  key.cipher && key.cipher.kind !== "none" ? { ...s, deciphered: decipher(s.text, key.cipher) } : s;

/** Read a fabric (border included) with its key. */
export function decodeWithKey(cells: readonly (readonly Bit[])[], key: ParcelKey): UnhideSteps {
  const fullWidth = cells[0]?.length ?? 0;
  const inner = unframe(cells, key.border);
  const shift = ([r, c]: Cell): Cell => [r + key.border, c + key.border];
  return withCipher(key.hide.mode === "motif" ? motifSteps(inner, key, shift, fullWidth) : scatterSteps(inner, key, shift, fullWidth), key);
}

function motifSteps(inner: Bit[][], key: ParcelKey, shift: (c: Cell) => Cell, fullWidth: number): DecodeSteps {
  const m = MOTIFS[(key.hide as { motif: keyof typeof MOTIFS }).motif];
  const { grid, notes, fits } = reduce(inner, m);
  const tileCells = ([r, c]: Cell): Cell[] =>
    Array.from({ length: m.size * m.size }, (_, i) => shift([r * m.size + Math.floor(i / m.size), c * m.size + (i % m.size)]));
  const s = decodeCells(grid, 0, key.encoding);
  const findings: Finding[] = [
    ...(fits ? [] : [{ severity: "error" as const, message: `The fabric inside the border is not a whole number of ${m.size} by ${m.size} tiles; the extra stitches were ignored.`, cells: [] }]),
    ...notes.map((n) => {
      const at = tileCells(n.cell);
      return { severity: n.off > 1 ? ("error" as const) : ("note" as const), message: `${n.message} (${describeCells(at, fullWidth)})`, cells: at };
    }),
    // Findings from the tile grid point at tiles; widen them to the tiles' stitches.
    ...s.findings.map((f) => ({ ...f, cells: f.cells.flatMap(tileCells) })),
  ];
  return { ...s, findings, ok: findings.every((f) => f.severity === "note") };
}

function scatterSteps(inner: Bit[][], key: ParcelKey, shift: (c: Cell) => Cell, fullWidth: number): DecodeSteps {
  const hide = key.hide as { seed: number };
  const length = key.length ?? 0;
  const height = inner.length;
  const width = inner[0]?.length ?? 0;
  if (width !== key.width || height !== key.height) {
    return {
      orientation: UPRIGHT,
      orientationText: "not read",
      bits: [],
      symbols: [],
      text: "",
      findings: [{ severity: "error", message: `The key is for a field ${key.width} by ${key.height} inside the border; this one is ${width} by ${height}.`, cells: [] }],
      ok: false,
    };
  }
  // The key does not say which way up the fabric was photographed, so try every turn and keep the cleanest reading.
  const route = routeCells(hide.seed, length, width, height);
  // The sync pattern settles the turn; decoding errors only break ties.
  const tries = ORIENTATIONS.map((o) => {
    const upright = transform(inner, o);
    const all = readScatter(upright, hide.seed, length);
    const syncOff = SYNC.reduce<number>((n, b, i) => n + (all[i] === b ? 0 : 1), 0);
    const bits = all.slice(SYNC.length);
    const toCells = ([from, to]: Span): Cell[] => route.slice(Math.max(from, 0) + SYNC.length, Math.max(to, 0) + SYNC.length).map((c) => shift(mapCell(c, o, height, width)));
    const d = decodeStream(bits, key.encoding, toCells, fullWidth);
    const errors = d.findings.filter((f) => f.severity === "error").length + (d.text.match(/\uFFFD/g)?.length ?? 0);
    return { o, bits, d, syncOff, score: syncOff * 1000 + errors };
  });
  const best = tries.reduce((a, t) => (t.score < a.score ? t : a));
  const turned = best.o.rotated180 || best.o.mirrored || best.o.inverted;
  const findings: Finding[] = [
    ...(turned ? [{ severity: "note" as const, message: `Fabric was ${describeOrientation(best.o)}; read the right way round.`, cells: [] }] : []),
    ...(best.syncOff > 0
      ? [{ severity: "error" as const, message: `${best.syncOff} of the ${SYNC.length} sync cells at the start of the route do not match; the reading may be off.`, cells: route.slice(0, SYNC.length).map((c) => shift(mapCell(c, best.o, height, width))) }]
      : []),
    ...best.d.findings,
  ];
  return {
    orientation: best.o,
    orientationText: describeOrientation(best.o),
    bits: best.bits,
    symbols: best.d.symbols,
    text: best.d.text,
    findings,
    ok: findings.every((f) => f.severity === "note"),
  };
}

/** The route as cells of the upright field, in reading order. */
function routeCells(seed: number, length: number, width: number, height: number): Cell[] {
  return scatterRoute(seed, length, width * height).map((pos) => [Math.floor(pos / width), pos % width] as Cell);
}
