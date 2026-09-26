// Case generator (Phase G2) for The Purloined Parcel. A level and a seed give
// one case: a message, the settings that hide it, the chart as the player sees
// it (turned, or with a knitter's mistake), a briefing, hints, and a text
// description for players who cannot see the drawing (G5).
//
// Every case is fiction. Briefings never claim a real person used the method.

import { createProject, type EncodingSettings, type ProjectSettings } from "./project";
import { type Visible } from "./construction";
import { dataCellOrder, transform, type Orientation, UPRIGHT } from "./grid";
import { blockLength } from "./errorcontrol";
import { rng } from "./fabric";

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
];

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
    default:
      return ["Find the marker row 1 1 0 1 at one edge. That edge is the bottom; the row of all purl is the top.", table, "Put your reading into the decoder machine."];
  }
}

function describe(shown: Visible[][]): string {
  const name: Record<Visible, string> = { knit: "knit", purl: "purl", A: "cream", B: "red" };
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
  const message = pick(r, MESSAGES);
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
  // Turn the visible chart the same way the logical grid would turn.
  const states = project.output.chart;
  const bits = states.map((row) => row.map((v) => (v === "purl" || v === "B" ? 1 : 0) as 0 | 1));
  const turned = transform(bits, orientation);
  const [zero, one] = settings.carrier.id === "two-colour" ? (["A", "B"] as const) : (["knit", "purl"] as const);
  const shown: Visible[][] = turned.map((row) => row.map((b) => (b ? one : zero)));

  let mistake: Case["mistake"];
  if (level.n === 5) {
    // Flip one of the five letter cells of one message character (block 0 is START).
    const e = settings.encoding;
    const B = e.alphabet === "fivebit" ? blockLength(e.errorControl) : 5;
    const k = 1 + Math.floor(r() * project.message.normalized.length);
    const index = k * B + Math.floor(r() * 5);
    const [row, col] = dataCellOrder(shown.length, shown[0]!.length, settings.layout.border)[index]!;
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
    description: describe(shown),
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
