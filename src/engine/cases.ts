// Case generator (Phase G2) for The Purloined Parcel. A level and a seed give
// one case: a message, the settings that hide it, the chart as the player sees
// it (turned, or with a knitter's mistake), a briefing, hints, and a text
// description for players who cannot see the drawing (G5).
//
// Every case is fiction. Briefings never claim a real person used the method.

import { createProject, type EncodingSettings, type ProjectSettings } from "./project";
import { type Visible } from "./construction";
import { borderOf, dataCellOrder, transform, type Orientation, UPRIGHT } from "./grid";
import { blockLength } from "./errorcontrol";
import { rng } from "./fabric";
import { MOTIFS, reduce, type MotifId } from "./motifs";
import { reduceUnits, UNITS, type UnitId } from "./units";

export interface Level {
  n: number;
  name: string;
  /** What the level teaches, shown on the case list. */
  teaches: string;
}

export const LEVELS: Level[] = [
  { n: 1, name: "First stitches", teaches: "Five cells make a letter. The key is in the file." },
  { n: 2, name: "Wrong way round", teaches: "The parcel was photographed turned over. Find the marker row." },
  { n: 3, name: "Dots and dashes", teaches: "Purl bumps in runs: Morse code." },
  { n: 4, name: "Two yarns", teaches: "Bacon's A/B alphabet, knitted in two colours." },
  { n: 5, name: "A slipped stitch", teaches: "The knitter made a mistake. Let the checks find it." },
  { n: 6, name: "The detective's key", teaches: "A Vigenère cipher on top of the stitches. The key is a name from Poe." },
  { n: 7, name: "Hidden in plain sight", teaches: "A pattern of little windows. The key card says how to read them." },
  { n: 8, name: "Crossed cables", teaches: "Each cable crosses one way or the other. The lean is the bit." },
  { n: 9, name: "Holes in the lace", teaches: "Eyelets and decreases in pairs: which way does the pair lean?" },
  { n: 10, name: "A trail of bobbles", teaches: "A bobble or none, block by block." },
];

/** Levels whose stitches come in blocks: one cell of the copy per block. */
const BLOCK_LEVELS: Record<number, UnitId> = { 8: "cable", 9: "lace", 10: "bobble" };

/** What each block looks like, for the words-only description: never what it means. */
const BLOCK_WORDS: Record<UnitId, [string, string]> = {
  cable: ["cable crossing to the left", "cable crossing to the right"],
  lace: ["decrease leaning left, hole on its right", "hole, then a decrease leaning right"],
  bobble: ["plain", "bobble"],
  bead: ["plain", "bead"],
};

// Block levels knit every cell as several stitches, so their messages are short.
const SHORT = ["BLUE DOOR", "TEA AT FOUR", "SIX SHARP", "UNDER THE MAT", "BY THE GATE", "AT NOON", "ASK DUPIN", "MORE WOOL"];

// Short, gentle messages in the spirit of Poe's letter: things hidden in plain sight.
const MESSAGES = [
  "CHECK THE CARD RACK",
  "IN PLAIN SIGHT",
  "MEET AT NOON",
  "THE KEY IS UNDER THE MAT",
  "LOOK BEHIND THE CLOCK",
  "BRING MORE WOOL",
  "THE LETTER IS SAFE",
  "TRAIN AT SIX",
  "ASK FOR DUPIN",
  "THE BLUE DOOR",
  "TEA AT FOUR",
  "WAIT BY THE BRIDGE",
];

export interface Case {
  id: string;
  level: Level;
  seed: number;
  title: string;
  briefing: string[];
  /** The message, as the alphabet carries it. */
  answer: string;
  settings: ProjectSettings;
  /** What the player sees: row 0 at the bottom of the image. */
  shown: Visible[][];
  orientation: Orientation;
  /** Level 5: the stitch the knitter got wrong, in `shown` coordinates. */
  mistake?: [row: number, col: number];
  hints: string[];
  /** Block levels (cables, lace, bobbles): the copy has one cell per block of stitches. */
  blocks?: { unit: UnitId; rows: number; cols: number };
  /** Motif cases: the image is made of tiles, and the copy has one cell per tile. */
  tiles?: { size: number; rows: number; cols: number };
  /** How many hints before the decoder machine switches on. */
  machineAfter: number;
  /** For ciphered cases, how many hints before the machine also deciphers. */
  decipherAfter?: number;
  /** Stitch-by-stitch text for players who cannot see the drawing. Describes, never decodes. */
  description: string;
}

const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;

const FIVE_PLAIN: EncodingSettings = { alphabet: "fivebit", errorControl: { code: "plain", separator: false, checksum: false } };

function settingsFor(level: number, message: string): ProjectSettings {
  const base = { title: "Evidence", message, layout: { width: 10, border: false }, construction: { method: "flat", firstRow: "RS" } } as const;
  switch (level) {
    case 3:
      return { ...base, encoding: { alphabet: "morse" }, layout: { width: 16, border: false }, carrier: { id: "purl-relief" } };
    case 4:
      return { ...base, encoding: { alphabet: "bacon", variant: "historical24" }, carrier: { id: "two-colour", colours: { A: "cream", B: "red" } } };
    case 5:
      return { ...base, encoding: { alphabet: "fivebit", errorControl: { code: "parity", separator: true, checksum: true } }, layout: { width: 14, border: false }, carrier: { id: "purl-relief" } };
    case 6:
      return { ...base, encoding: FIVE_PLAIN, carrier: { id: "purl-relief" }, cipher: { kind: "vigenere", key: "DUPIN" } };
    case 7:
      return { ...base, encoding: FIVE_PLAIN, layout: { width: 8, border: false }, carrier: { id: "purl-relief" }, hide: { mode: "motif", motif: "window" } };
    case 8:
      return { ...base, encoding: FIVE_PLAIN, layout: { width: 6, border: false }, carrier: { id: "cable" } };
    case 9:
      return { ...base, encoding: FIVE_PLAIN, layout: { width: 8, border: false }, carrier: { id: "lace" } };
    case 10:
      return { ...base, encoding: FIVE_PLAIN, layout: { width: 8, border: false }, carrier: { id: "bobble" } };
    default:
      return { ...base, encoding: FIVE_PLAIN, carrier: { id: "purl-relief" } };
  }
}

function briefingFor(level: number): string[] {
  const common = "A parcel reached the archive with a knitted cuff inside and no letter. The label says only: read the stitches.";
  switch (level) {
    case 1:
      return [common, "The bottom row is a marker (1 1 0 1 from the left), the top row is all purl. Between them, read right to left from the bottom, five stitches to a letter: knit is 0, purl is 1."];
    case 2:
      return [common, "This one was photographed carelessly. It may be upside down, mirrored, or showing its wrong side. The marker row tells you which way is up."];
    case 3:
      return [common, "No groups of five here. Runs of purl bumps and gaps of knit, read right to left from the bottom, row after row."];
    case 4:
      return [common, "Two yarns, groups of five, and an old alphabet with only 24 letters: I and J share a code, and so do U and V. Bacon's alphabet is a historical puzzle cipher, not modern security."];
    case 5:
      return [common, "The knitter was in a hurry. Each letter has a check stitch and a separator, and the message ends with a checksum. One stitch is wrong."];
    case 7:
      return [
        "This parcel held the end of a scarf covered in little squares, and nothing else. Tucked into the lining was a key card.",
        "KEY CARD / WINDOWS. An open window (a knit stitch in the middle) is 0, a filled square is 1. Read the squares like a chart from the lab: marker row at the bottom, right to left, bottom up, five to a letter.",
        "Steganography hides that a message is there at all. Without the card, this is just a pattern.",
      ];
    case 8:
      return [
        "This parcel held a thick cabled cuff. Every block of six stitches has one cable, crossing once.",
        "A crossing that leans left (the front strand climbs to the left) is 0; one that leans right is 1.",
        "The blocks make the usual grid: the bottom row of blocks is a marker (1 1 0 1 from the left), the top row is all 1. Between them, read right to left from the bottom, five blocks to a letter.",
      ];
    case 9:
      return [
        "A lace sleeve, full of little holes. Each block pairs an eyelet with a decrease.",
        "A decrease leaning left, with the hole on its right, is 0; the hole first, then a decrease leaning right, is 1.",
        "The blocks make the usual grid: the bottom row of blocks is a marker (1 1 0 1 from the left), the top row is all 1. Between them, read right to left from the bottom, five blocks to a letter.",
      ];
    case 10:
      return [
        "A cuff with a scattering of bobbles, like a trail of berries.",
        "Each block of three stitches either has a bobble (1) or does not (0).",
        "The blocks make the usual grid: the bottom row of blocks is a marker (1 1 0 1 from the left), the top row is all 1. Between them, read right to left from the bottom, five blocks to a letter.",
      ];
    default:
      return [
        common,
        "The stitches read cleanly, five to a letter, but the words make no sense. A note pinned to the cuff says: the key is the name of the man who found the purloined letter.",
        "Vigenère is a historical puzzle cipher, not modern security.",
      ];
  }
}

function hintsFor(level: number): string[] {
  const table = "Five-bit key: A=00000, B=00001, C=00010 ... Z=11001, space=11010, full stop=11011. START=11100 and END=11101 frame the message.";
  switch (level) {
    case 3:
      return ["Find the marker row first; everything above it (below the top row) is the message.", "A single purl is a dot, three in a row a dash. One knit separates dots and dashes, three separate letters, seven separate words.", "Put your reading into the decoder machine."];
    case 4:
      return ["The marker row is at the bottom: red, red, cream, red, then cream, reading from the left.", "Cream is A, red is B. Groups of five, read right to left from the bottom. AAAAA is A, AAAAB is B, ABAAA is I or J.", "Put your reading into the decoder machine."];
    case 5:
      return ["Each letter is 5 cells, then a check cell (even parity), then a separator (always purl).", table, "Put your reading into the decoder machine: it will show which letter has the bad stitch. The letter is one cell away from a real word."];
    case 6:
      return [
        "In Poe's story the letter is found by the detective C. Auguste Dupin. The key is DUPIN.",
        `${table} Read the stitches first: you get a scrambled message.`,
        "The decoder machine is on: it reads your copy into the scrambled message.",
        "To unscramble, take each letter back by the matching key letter (D=3, U=20, P=15, I=8, N=13), repeating DUPIN and skipping spaces. The machine now does it for you.",
      ];
    case 7:
      return [
        "The bottom row of squares is the marker: filled, filled, open, filled, then open. The top row of squares is all filled.",
        table,
        "Your copy has one cell per square: switch it on for a filled square. The decoder machine is on.",
      ];
    case 8:
    case 9:
    case 10: {
      const what = level === 8 ? "each cable: leaning right is 1" : level === 9 ? "each pair: leaning right is 1" : "each block with a bobble as 1";
      return [
        "Mark one cell per block, not per stitch. Start with the bottom row of blocks: it is the marker, 1 1 0 1 then 0s from the left.",
        `Then mark ${what}, row by row. The top row of blocks should come out all 1.`,
        table,
        "Put your reading into the decoder machine.",
      ];
    }
    default:
      return ["Find the marker row 1 1 0 1 at one edge. That edge is the bottom; the row of all purl is the top.", table, "Put your reading into the decoder machine."];
  }
}

/** Tile by tile, for motif cases: what each square looks like, never what it means. */
function describeTiles(shown: Visible[][], motif: MotifId): string {
  const size = MOTIFS[motif].size;
  const bits = shown.map((row) => row.map((v) => (v === "purl" || v === "B" ? 1 : 0) as 0 | 1));
  const tiles = reduce(bits, MOTIFS[motif]).grid;
  const lines = tiles.map((row, r) => {
    const runs: string[] = [];
    for (let i = 0; i < row.length; ) {
      let j = i;
      while (j + 1 < row.length && row[j + 1] === row[i]) j++;
      runs.push(`${j - i + 1} ${row[i] ? "filled" : "open"}`);
      i = j + 1;
    }
    return `Row ${r + 1} of squares (counting from the bottom), left to right: ${runs.join(", ")}.`;
  });
  return [`The image shows little ${size} by ${size} squares, ${tiles.length} rows of ${tiles[0]?.length ?? 0}. Each square is either open, with a knit stitch in the middle, or filled.`, ...lines.reverse()].join("\n");
}

/** Block by block, for cable, lace and bobble cases: what each block looks like, never what it means. */
function describeBlocks(shown: Visible[][], unit: UnitId): string {
  const u = UNITS[unit];
  const grid = reduceUnits(shown, u, 0).cells;
  const lines = grid.map((row, r) => {
    const runs: string[] = [];
    for (let i = 0; i < row.length; ) {
      let j = i;
      while (j + 1 < row.length && row[j + 1] === row[i]) j++;
      runs.push(`${j - i + 1} × ${BLOCK_WORDS[unit][row[i]!]}`);
      i = j + 1;
    }
    return `Row ${r + 1} of blocks (counting from the bottom), left to right: ${runs.join("; ")}.`;
  });
  return [`The image shows blocks of ${u.width} stitches by ${u.height} rows, ${grid.length} rows of ${grid[0]?.length ?? 0} blocks.`, ...lines.reverse()].join("\n");
}

function describe(shown: Visible[][]): string {
  const name: Record<Visible, string> = { knit: "knit", purl: "purl", A: "cream", B: "red", c4f: "left cable", c4b: "right cable", yo: "eyelet", k2tog: "right lean", ssk: "left lean", mb: "bobble", pb: "bead" };
  const w = shown[0]?.length ?? 0;
  const lines = [...shown].map((row, r) => {
    // Runs, left to right as seen: "3 knit, 1 purl".
    const runs: string[] = [];
    for (let i = 0; i < row.length; ) {
      let j = i;
      while (j + 1 < row.length && row[j + 1] === row[i]) j++;
      runs.push(`${j - i + 1} ${name[row[i]!]}`);
      i = j + 1;
    }
    return `Row ${r + 1} of the image (counting from the bottom), left to right: ${runs.join(", ")}.`;
  });
  return [`The image shows ${shown.length} rows of ${w} stitches.`, ...lines.reverse()].join("\n");
}

/** Build one case. Same level and seed, same case. */
export function makeCase(levelN: number, seed: number): Case {
  const level = LEVELS.find((l) => l.n === levelN) ?? LEVELS[0]!;
  const r = rng(seed * 31 + level.n);
  const unit = BLOCK_LEVELS[level.n];
  const message = pick(r, unit ? SHORT : MESSAGES);
  const settings = settingsFor(level.n, message);
  const project = createProject(settings, `case-${level.n}-${seed}`);

  let orientation: Orientation = UPRIGHT;
  if (level.n === 2) {
    orientation = pick(r, [
      { rotated180: true, mirrored: false, inverted: false },
      { rotated180: true, mirrored: true, inverted: false },
      { rotated180: false, mirrored: true, inverted: true },
      { rotated180: true, mirrored: false, inverted: true },
    ]);
  }
  // Turn the visible chart the same way the logical grid would turn. Block levels are shown as knitted.
  const states = project.output.chart;
  const bits = states.map((row) => row.map((v) => (v === "purl" || v === "B" ? 1 : 0) as 0 | 1));
  const turned = transform(bits, orientation);
  const [zero, one] = settings.carrier.id === "two-colour" ? (["A", "B"] as const) : (["knit", "purl"] as const);
  const shown: Visible[][] = unit ? states.map((row) => [...row]) : turned.map((row) => row.map((b) => (b ? one : zero)));

  let mistake: Case["mistake"];
  if (level.n === 5) {
    // Flip one of the five letter cells of one message character (block 0 is START).
    const e = settings.encoding;
    const B = e.alphabet === "fivebit" ? blockLength(e.errorControl) : 5;
    const k = 1 + Math.floor(r() * project.message.normalized.length);
    const index = k * B + Math.floor(r() * 5);
    const [row, col] = dataCellOrder(shown.length, shown[0]!.length, borderOf(settings.layout))[index]!;
    shown[row]![col] = shown[row]![col] === "knit" ? "purl" : "knit";
    mistake = [row, col];
  }

  return {
    id: `${level.n}-${seed}`,
    level,
    seed,
    title: `Case ${level.n}.${String(seed).padStart(3, "0")}: ${level.name}`,
    briefing: briefingFor(level.n),
    answer: project.message.normalized,
    settings,
    shown,
    orientation,
    ...(mistake ? { mistake } : {}),
    hints: hintsFor(level.n),
    machineAfter: level.n === 6 ? 3 : hintsFor(level.n).length,
    ...(level.n === 6 ? { decipherAfter: 4 } : {}),
    description: unit ? describeBlocks(shown, unit) : project.output.key?.hide.mode === "motif" ? describeTiles(shown, project.output.key.hide.motif) : describe(shown),
    ...(unit ? { blocks: { unit, rows: project.output.logicalGrid.length, cols: project.output.logicalGrid[0]!.length } } : {}),
    ...(project.output.key?.hide.mode === "motif" ? { tiles: { size: MOTIFS[project.output.key.hide.motif].size, rows: project.output.key.height, cols: project.output.key.width } } : {}),
  };
}

/** Compare a guess with the answer, forgiving case, spacing, punctuation, and Bacon's shared letters. */
export function checkAnswer(c: Case, guess: string): boolean {
  const bacon = c.settings.encoding.alphabet === "bacon";
  const clean = (s: string) => {
    let t = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (bacon) t = t.replace(/J/g, "I").replace(/V/g, "U");
    return t;
  };
  return clean(guess) !== "" && clean(guess) === clean(c.answer);
}
