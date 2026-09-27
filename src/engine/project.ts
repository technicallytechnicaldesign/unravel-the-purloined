// Project object (packet section 37): every setting and every pipeline stage
// for one pattern, serializable so a pattern can be exported as JSON and
// re-imported. Output is always regenerated from the settings, so a file
// edited by hand cannot smuggle in a chart the settings would not make.

import { type Bit } from "./fivebit";
import * as fivebit from "./fivebit";
import * as morse from "./morse";
import * as bacon from "./bacon";
import { type Dropped } from "./normalize";
import { decodeFrame, encodeFrame, type ErrorControlOptions } from "./errorcontrol";
import { readStripes, ROWS_PER_UNIT, stripeRows } from "./stripes";
import { layoutGlyphs, PACKS, readGlyphs, type GlyphPack } from "./glyphs";
import { borderOf, frame, layout, readGrid, unframe, type CellRole, type GridOptions, type LogicalGrid } from "./grid";
import { expand, MOTIFS } from "./motifs";
import { scatterCanvas, scatterHeight, SYNC, type HideSettings } from "./stego";
import { KEY_FORMAT, keyCode, type ParcelKey } from "./key";
import { decodeWithKey } from "./unhide";
import { isSpecial, toChart, translate, type Construction, type Row, type Visible } from "./construction";
import { expandUnits, reduceUnits, UNITS, type Unit, type UnitId } from "./units";
import { family, longFloats, purlRelief, read, render, twoColour, type Carrier, type CarrierId, type ColourNames, type LegendEntry } from "./carrier";
import { ABBREVIATIONS, checkStitchCounts, writeRows, writtenAs } from "./pattern";
import { CIPHERS, decipher, encipher, PUZZLE_LABEL, type CipherSettings } from "./ciphers";
import { applyBorder, PATTERNS, type StitchPattern } from "./stitches";
import { SECURE_VERSION } from "./secure";
import { dimensions, evenRows, RECIPES, sectionRows, writeSection, type RecipeId } from "./recipes";

export const PROJECT_FORMAT = "unravel-the-purloined/project";
export const PROJECT_VERSION = 1;

export type EncodingSettings =
  | { alphabet: "fivebit"; errorControl: ErrorControlOptions }
  | { alphabet: "morse" }
  | { alphabet: "bacon"; variant: bacon.BaconAlphabet };

export interface ProjectSettings {
  title: string;
  message: string;
  encoding: EncodingSettings;
  layout: GridOptions;
  carrier: { id: CarrierId; colours?: ColourNames };
  construction: Construction;
  /** Optional classical cipher, applied after normalizing and before encoding. */
  cipher?: CipherSettings;
  /** The recipe the settings started from, for the cast-on and finishing words. */
  recipe?: RecipeId;
  /** Stitch pattern for the border cells; plain when unset. */
  borderStyle?: StitchPattern;
  /** Plain rows below and above the chart. Rounded up to even numbers. */
  edges?: { below: number; above: number; pattern: StitchPattern };
  /** Hide the message by scattering it in a filler or turning cells into motifs (steganography). */
  hide?: HideSettings;
  /** Knit the letters themselves as small motifs (the motif alphabet), instead of encoding them as cells. */
  glyphs?: { pack: GlyphPack };
  /** The message is secure-mode ciphertext written as letters A to P (see secure.ts). The plaintext and passphrase are never stored. */
  secure?: { version: typeof SECURE_VERSION };
}

export interface Project {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_VERSION;
  id: string;
  settings: ProjectSettings;
  message: {
    normalized: string;
    /** The enciphered text that is actually knitted, when a cipher is set. */
    enciphered?: string;
    dropped: Dropped[];
    /** Anything the reader should know about how the text was changed or carried. */
    notes: string[];
  };
  output: {
    bits: Bit[];
    logicalGrid: Bit[][];
    roles: CellRole[][];
    chart: Visible[][];
    rows: Row[];
    /** Cast on and the plain section below the chart. */
    preamble: string[];
    /** Chart rows, written out. */
    instructions: string[];
    /** The plain section above the chart, and finishing. */
    finishing: string[];
    /** Rough finished size. */
    dimensions: string;
    /** What each special stitch used in the pattern means, e.g. "C4F: cable 4 front...". */
    abbreviations: string[];
    /** For hidden messages: the key a reader needs, and the same key as a short code. */
    key?: ParcelKey;
    keyCode?: string;
    legend: LegendEntry[];
    carrierNotes: string[];
    /** Stitch-count and float checks, one plain line each. Empty is good. */
    checks: string[];
    /** The pattern decoded back to text, as proof the chain holds. */
    decoded: string;
  };
}

function carrierFor(s: ProjectSettings["carrier"]): Carrier {
  if (s.id === "two-colour") return twoColour(s.colours);
  if (s.id === "stripes") {
    const c = twoColour(s.colours);
    return {
      ...c,
      id: "stripes",
      name: "Stripe-interval code",
      notes: [
        `Morse in stripes: every Morse unit is ${ROWS_PER_UNIT} rows, so a dot is a stripe ${ROWS_PER_UNIT} rows deep in colour B, a dash ${3 * ROWS_PER_UNIT} rows. Colour A fills the gaps.`,
        "Read it from the cast-on edge: upside down, the stripes run backwards.",
        "Every row is one colour, so there are no floats.",
      ],
    };
  }
  if (s.id in UNITS) {
    const u = UNITS[s.id as UnitId];
    return { id: s.id, name: u.name, states: ["knit", "purl"], legend: u.legend, notes: u.notes };
  }
  return purlRelief();
}

/** The row inside each unit block that holds special stitches: whichever lands on right-side rows. */
const specialRow = (c: Construction): number => (c.method === "flat" && c.firstRow === "WS" ? 1 : 0);
const unitOf = (id: CarrierId): Unit | undefined => (id in UNITS ? UNITS[id as UnitId] : undefined);

const activeCipher = (c?: CipherSettings): CipherSettings | undefined => (c && c.kind !== "none" ? c : undefined);
const SUBSTITUTION = new Set(["caesar", "keyword", "vigenere"]);

function encodeMessage(message: string, e: EncodingSettings, c?: CipherSettings): { normalized: string; enciphered?: string; dropped: Dropped[]; notes: string[]; bits: Bit[] } {
  const cipher = activeCipher(c);
  if (!cipher) return encodePlain(message, e);
  if (e.alphabet === "bacon" && e.variant === "historical24" && SUBSTITUTION.has(cipher.kind)) {
    throw new Error("Bacon's 24-letter alphabet cannot carry every letter a substitution cipher makes (J and V). Use the 26-letter Bacon, or a transposition cipher.");
  }
  // Normalize for the alphabet first, then encipher, then encode the enciphered text.
  const plain = encodePlain(message, e);
  const enciphered = encipher(plain.normalized, cipher);
  // The ciphertext uses only characters the alphabet carries, so it is encoded as is.
  const bits =
    e.alphabet === "morse" ? morse.toUnits(morse.encode(enciphered))
    : e.alphabet === "bacon" ? bacon.encode(enciphered, e.variant)
    : encodeFrame(enciphered, e.errorControl);
  return {
    normalized: plain.normalized,
    enciphered,
    dropped: plain.dropped,
    notes: [...plain.notes, `${CIPHERS[cipher.kind].name}, key ${cipher.key.trim().toUpperCase()}. ${PUZZLE_LABEL}`],
    bits,
  };
}

function encodePlain(message: string, e: EncodingSettings): { normalized: string; dropped: Dropped[]; notes: string[]; bits: Bit[] } {
  if (e.alphabet === "morse") {
    const n = morse.normalize(message);
    return { normalized: n.text, dropped: n.dropped, notes: [], bits: morse.toUnits(morse.encode(n.text)) };
  }
  if (e.alphabet === "bacon") {
    const n = bacon.normalize(message, e.variant);
    const notes = [
      bacon.ALPHABET_LABEL[e.variant],
      "Bacon's biliteral alphabet is a historical / puzzle cipher, not modern security.",
      ...n.merged.map((m) => `Letter ${m.position}: ${m.char} written as ${m.as}.`),
    ];
    return { normalized: n.text, dropped: n.dropped, notes, bits: bacon.encode(n.text, e.variant) };
  }
  const n = fivebit.normalize(message);
  return { normalized: n.text, dropped: n.dropped, notes: [], bits: encodeFrame(n.text, e.errorControl) };
}

/** Read a finished pattern back to text, through every stage in reverse. */
export function decodeRows(rows: readonly Row[], settings: ProjectSettings, key?: ParcelKey): string {
  const chart = toChart(rows);
  const unit = unitOf(settings.carrier.id);
  const cells = unit ? reduceUnits(chart, unit, specialRow(settings.construction)).cells : read(chart, carrierFor(settings.carrier)).cells;
  if (key) {
    const s = decodeWithKey(cells, key);
    return s.deciphered ?? s.text;
  }
  const cipherFor = activeCipher(settings.cipher);
  const plain = (t: string) => (cipherFor ? decipher(t, cipherFor) : t);
  if (settings.glyphs) return plain(readGlyphs(unframe(cells, borderOf(settings.layout)), settings.glyphs.pack).text);
  if (settings.carrier.id === "stripes") return plain(morse.decodeUnits(readStripes(unframe(cells, borderOf(settings.layout))).units).text);
  const bits = readGrid(cells, borderOf(settings.layout)).bits;
  const e = settings.encoding;
  const text = e.alphabet === "morse" ? morse.decodeUnits(bits).text : e.alphabet === "bacon" ? bacon.decode(bits, e.variant).text : decodeFrame(bits, e.errorControl).text;
  const cipher = activeCipher(settings.cipher);
  return cipher ? decipher(text, cipher) : text;
}

const newId = () => globalThis.crypto?.randomUUID?.() ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Run the whole pipeline for one set of settings. */
export function createProject(settings: ProjectSettings, id: string = newId()): Project {
  checkCombination(settings);
  const msg = settings.glyphs ? glyphMessage(settings) : encodeMessage(settings.message, settings.encoding, settings.cipher);
  if (settings.secure) {
    if (msg.normalized !== settings.message) throw new Error("This alphabet cannot carry the secure letters unchanged. Choose the five-bit alphabet, Morse, modern Bacon or a motif alphabet.");
    msg.notes.push(`Encrypted with AES-GCM before knitting: ${settings.message.length} letters from A to P, two per byte. One misread letter and the message will not open, so keep the error checks on.`);
  }
  const carrier = carrierFor(settings.carrier);
  const { grid, key } = settings.hide
    ? hidden(settings, msg.bits, carrier.id)
    : settings.glyphs
      ? { grid: glyphGrid(settings, msg.enciphered ?? msg.normalized), key: undefined }
      : carrier.id === "stripes"
        ? { grid: stripeGrid(settings, msg.bits), key: undefined }
        : { grid: layout(msg.bits, settings.layout), key: undefined };
  const unit = unitOf(carrier.id);
  const expanded = unit ? expandUnits(grid.cells, grid.roles, unit, specialRow(settings.construction)) : { chart: render(grid.cells, carrier), roles: grid.roles };
  let chart = expanded.chart;
  const style = settings.borderStyle;
  if (style && expanded.roles.some((row) => row.includes("border"))) {
    checkPattern(style, carrier.id, "border");
    chart = applyBorder(chart, (r, c) => expanded.roles[r]![c] === "border", style);
  }
  const rows = translate(chart, settings.construction);
  const words = writeAround(settings, chart);
  const floats =
    carrier.id === "two-colour"
      ? longFloats(chart).map((f) => `Row ${f.row}: ${f.length} stitches from stitch ${f.from} (counted from the left) float ${f.colour} behind; catch it.`)
      : [];
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    id,
    settings,
    message: { normalized: msg.normalized, ...(msg.enciphered !== undefined ? { enciphered: msg.enciphered } : {}), dropped: msg.dropped, notes: msg.notes },
    output: {
      bits: msg.bits,
      logicalGrid: grid.cells,
      roles: grid.roles,
      chart,
      rows,
      preamble: words.preamble,
      instructions: writeRows(rows, settings.construction.method),
      finishing: words.finishing,
      abbreviations: abbreviationsFor(rows),
      dimensions: dimensions(chart[0]!.length, chart.length + words.plainRows, settings.construction.method),
      legend: carrier.legend,
      carrierNotes: carrier.notes,
      checks: [...checkStitchCounts(rows, chart[0]!.length), ...floats],
      ...(key ? { key, keyCode: keyCode(key) } : {}),
      decoded: decodeRows(rows, settings, key),
    },
  };
}

/** Settings that cannot work together, refused with the reason. */
function checkCombination(s: ProjectSettings): void {
  if (s.carrier.id === "stripes" && s.encoding.alphabet !== "morse" && !s.glyphs) throw new Error("The stripe-interval code carries Morse: choose Morse code as the transform.");
  if (s.carrier.id === "stripes" && (s.glyphs || s.hide)) throw new Error("Stripes carry Morse on their own; they cannot also be hidden or drawn as letters.");
  if (s.glyphs && s.hide) throw new Error("The motif alphabet shows its letters openly, so it cannot also be hidden.");
  if (s.secure && s.cipher && s.cipher.kind !== "none") throw new Error("Secure mode already encrypts the message; a classical cipher on top adds nothing. Choose one or the other.");
  if (s.secure && !/^[A-P]+$/.test(s.message)) throw new Error("A secure message holds only the letters A to P, as the encryption step writes them.");
}

/** The message for the motif alphabet: letters, digits, space, full stop and question mark, then any cipher. */
function glyphMessage(s: ProjectSettings): { normalized: string; enciphered?: string; dropped: Dropped[]; notes: string[]; bits: Bit[] } {
  const n = morse.normalize(s.message);
  const cipher = activeCipher(s.cipher);
  const pack = PACKS[s.glyphs!.pack];
  return {
    normalized: n.text,
    ...(cipher ? { enciphered: encipher(n.text, cipher) } : {}),
    dropped: n.dropped,
    notes: [`${pack.name}. Read left to right, top line first.`, ...(cipher ? [`${CIPHERS[cipher.kind].name}, key ${cipher.key.trim().toUpperCase()}. ${PUZZLE_LABEL}`] : [])],
    bits: [],
  };
}

function glyphGrid(s: ProjectSettings, text: string): LogicalGrid {
  const g = layoutGlyphs(text, s.glyphs!.pack, s.layout.width);
  return { options: s.layout, ...frame(g.cells, g.inGlyph.map((row) => row.map((x): CellRole => (x ? "data" : "filler"))), borderOf(s.layout)) };
}

function stripeGrid(s: ProjectSettings, units: Bit[]): LogicalGrid {
  const rows = stripeRows(units).map((b) => new Array<Bit>(s.layout.width).fill(b));
  return { options: s.layout, ...frame(rows, rows.map((r) => r.map((): CellRole => "data")), borderOf(s.layout)) };
}

/** Build the hidden fabric and its key: scattered in a filler, or as motif tiles. */
function hidden(settings: ProjectSettings, bits: Bit[], carrier: CarrierId): { grid: LogicalGrid; key: ParcelKey } {
  const hide = settings.hide!;
  const depth = borderOf(settings.layout);
  const width = settings.layout.width;
  let inner: { cells: Bit[][]; carries: boolean[][] };
  let size: { width: number; height: number; length?: number };
  if (hide.mode === "motif") {
    const plain = layout(bits, { width, border: false });
    inner = expand(plain.cells, MOTIFS[hide.motif]);
    size = { width, height: plain.cells.length };
  } else {
    const stream = [...SYNC, ...bits];
    const height = scatterHeight(stream.length, width, hide.density);
    inner = scatterCanvas(stream, width, height, hide.seed, hide.filler, carrier);
    size = { width, height, length: stream.length };
  }
  const framed = frame(inner.cells, inner.carries.map((row) => row.map((c): CellRole => (c ? "data" : "filler"))), depth);
  const key: ParcelKey = {
    format: KEY_FORMAT,
    version: 1,
    title: settings.title,
    hide,
    encoding: settings.encoding,
    ...(activeCipher(settings.cipher) ? { cipher: settings.cipher! } : {}),
    carrier,
    border: depth,
    ...size,
  };
  return { grid: { options: settings.layout, ...framed }, key };
}

/** The key to every special stitch the rows use, in the order they first appear. */
function abbreviationsFor(rows: readonly Row[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) for (const a of r.actions) if (isSpecial(a.stitch)) seen.add(writtenAs(a.stitch));
  return [...seen].map((k) => `${k}: ${ABBREVIATIONS[k]}.`);
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function checkPattern(p: StitchPattern, carrier: CarrierId, where: string): void {
  if (PATTERNS[p].carrier !== family(carrier)) {
    throw new Error(`${PATTERNS[p].name} is for ${PATTERNS[p].carrier === "two-colour" ? "two-colour" : "knit and purl"} work; choose another ${where} pattern for this carrier.`);
  }
}

/** Cast on, plain sections and finishing: the words around the chart. */
function writeAround(settings: ProjectSettings, chart: Visible[][]): { preamble: string[]; finishing: string[]; plainRows: number } {
  const c = settings.construction;
  const stitches = chart[0]!.length;
  const round = c.method === "round";
  const recipe = settings.recipe ? RECIPES[settings.recipe] : undefined;
  const below = evenRows(settings.edges?.below ?? 0);
  const above = evenRows(settings.edges?.above ?? 0);
  const pattern = settings.edges?.pattern;
  if (pattern && below + above > 0) checkPattern(pattern, settings.carrier.id, "edge");
  const unit = round ? "Rounds" : "Rows";

  const preamble = [
    round ? `Cast on ${stitches} stitches and join to work in the round, taking care not to twist.` : `Cast on ${stitches} stitches.`,
    ...(pattern && below ? writeSection(`Lower edge in ${lowerFirst(PATTERNS[pattern].name)}`, sectionRows(below, stitches, pattern, c, false), c.method) : []),
    `Chart: work ${unit.toLowerCase()} 1 to ${chart.length}, from the chart or the written ${unit.toLowerCase()} below. ${unit} are numbered from the start of the chart.`,
  ];
  const finishing = [
    ...(pattern && above ? writeSection(`Upper edge in ${lowerFirst(PATTERNS[pattern].name)}`, sectionRows(above, stitches, pattern, c, chart.length % 2 === 1), c.method) : []),
    recipe?.finish ?? "Bind off.",
  ];
  return { preamble, finishing, plainRows: below + above };
}

export function exportProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export interface ImportResult {
  project?: Project;
  /** Plain lines: why the file was refused, or what was corrected. */
  issues: string[];
}

/** Parse a project file, then regenerate its output from its settings. */
export function importProject(json: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { issues: ["This file is not valid JSON."] };
  }
  const p = data as Partial<Project> | null;
  if (!p || p.format !== PROJECT_FORMAT) return { issues: ["This is not an Unravel the Purloined project file."] };
  if (p.version !== PROJECT_VERSION) return { issues: [`Project version ${String(p.version)} is not supported; this site reads version ${PROJECT_VERSION}.`] };
  if (typeof p.id !== "string" || !p.settings) return { issues: ["The project file is missing its id or settings."] };

  let project: Project;
  try {
    project = createProject(p.settings, p.id);
  } catch (err) {
    return { issues: [`The settings could not be used: ${err instanceof Error ? err.message : String(err)}`] };
  }
  const issues = JSON.stringify(project) === JSON.stringify(data) ? [] : ["The stored pattern did not match its settings, so it was regenerated from the settings."];
  return { project, issues };
}
