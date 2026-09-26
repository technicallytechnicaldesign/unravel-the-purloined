// Morse symbol encoder (packet section 27.1). Variable-length: letters are runs
// of dots and dashes, so the gaps carry meaning too. Output is logical elements,
// then standard timing units (1 = mark, 0 = space); a carrier decides later
// that a mark is, say, a purl bump.
//
// Timing (ITU): dot 1 unit, dash 3, gap inside a letter 1, between letters 3,
// between words 7.

import { type Bit } from "./fivebit";
import { normalizeWith, type Normalized } from "./normalize";

export type MorseMark = "dot" | "dash";
export type MorseElement = MorseMark | "symbolGap" | "letterGap" | "wordGap";

// ITU letters, digits, and the two punctuation marks the five-bit alphabet also carries.
const TABLE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..",
  J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", "?": "..--..",
};
const REVERSE = new Map(Object.entries(TABLE).map(([ch, code]) => [code, ch]));

const UNITS: Record<MorseElement, { bit: Bit; length: number }> = {
  dot: { bit: 1, length: 1 },
  dash: { bit: 1, length: 3 },
  symbolGap: { bit: 0, length: 1 },
  letterGap: { bit: 0, length: 3 },
  wordGap: { bit: 0, length: 7 },
};

/** Uppercase, transliterate, and report anything Morse here cannot carry. */
export function normalize(input: string): Normalized {
  return normalizeWith(input, (ch) => ch in TABLE);
}

/** Encode normalized text to elements. Words are separated by one word gap. */
export function encode(text: string): MorseElement[] {
  const out: MorseElement[] = [];
  text.split(" ").forEach((word, w) => {
    if (w > 0) out.push("wordGap");
    Array.from(word).forEach((ch, l) => {
      const code = TABLE[ch];
      if (code === undefined) throw new Error(`Character ${JSON.stringify(ch)} has no Morse code here; normalize first.`);
      if (l > 0) out.push("letterGap");
      Array.from(code).forEach((m, i) => {
        if (i > 0) out.push("symbolGap");
        out.push(m === "." ? "dot" : "dash");
      });
    });
  });
  return out;
}

/** Human transcription: letters split by a space, words by " / ". */
export function transcribe(elements: readonly MorseElement[]): string {
  const glyph: Record<MorseElement, string> = { dot: ".", dash: "-", symbolGap: "", letterGap: " ", wordGap: " / " };
  return elements.map((e) => glyph[e]).join("");
}

/** Elements to timing units: 1 = mark, 0 = space. */
export function toUnits(elements: readonly MorseElement[]): Bit[] {
  return elements.flatMap((e) => new Array<Bit>(UNITS[e].length).fill(UNITS[e].bit));
}

export interface MorseIssue {
  kind: "ambiguous-length" | "unknown-letter";
  /** 1-based letter in the decoded text (spaces count). */
  letter: number;
  /** 0-based unit index, when decoding from units. */
  unit?: number;
  message: string;
}

export interface MorseDecodeResult {
  text: string;
  issues: MorseIssue[];
}

/** Decode elements to text. A letter with no table entry becomes U+FFFD and is reported. */
export function decode(elements: readonly MorseElement[]): MorseDecodeResult {
  return decodeTagged(elements.map((e) => ({ e })));
}

interface Tagged {
  e: MorseElement;
  unit?: number;
  /** Set when the run length was not a clean 1, 3 or 7. */
  note?: string;
}

function decodeTagged(elements: readonly Tagged[]): MorseDecodeResult {
  const issues: MorseIssue[] = [];
  let text = "";
  let code = "";
  let firstUnit: number | undefined;
  const flush = () => {
    if (code === "") return;
    const ch = REVERSE.get(code);
    if (ch === undefined) {
      issues.push({
        kind: "unknown-letter",
        letter: text.length + 1,
        ...(firstUnit === undefined ? {} : { unit: firstUnit }),
        message: `Letter ${text.length + 1} (${code}) is not in the Morse table.`,
      });
    }
    text += ch ?? "�";
    code = "";
    firstUnit = undefined;
  };
  for (const { e, unit, note } of elements) {
    // Gaps are processed before the letter they end is flushed, so the letter in hand is text.length + 1.
    if (note) issues.push({ kind: "ambiguous-length", letter: text.length + 1, ...(unit === undefined ? {} : { unit }), message: note });
    if (e === "dot" || e === "dash") {
      if (code === "") firstUnit = unit;
      code += e === "dot" ? "." : "-";
    } else if (e !== "symbolGap") {
      flush();
      if (e === "wordGap") text += " ";
    }
  }
  flush();
  return { text, issues };
}

/**
 * Decode timing units. Runs of exactly 1, 3 or 7 read cleanly; any other length
 * is read as the nearest element by threshold and reported with its position.
 * Leading and trailing spaces are border, not message.
 */
export function decodeUnits(units: readonly Bit[]): MorseDecodeResult {
  return decodeTagged(tagUnits(units));
}

/** Timing units back to elements by the same thresholds decodeUnits uses. */
export function readUnits(units: readonly Bit[]): MorseElement[] {
  return tagUnits(units).map((t) => t.e);
}

function tagUnits(units: readonly Bit[]): Tagged[] {
  const tagged: Tagged[] = [];
  let i = units.indexOf(1);
  const end = units.lastIndexOf(1);
  if (i < 0) return [];
  while (i <= end) {
    const bit = units[i]!;
    let n = 0;
    while (i + n <= end && units[i + n] === bit) n++;
    const at = `unit ${i + 1}`;
    if (bit === 1) {
      const e: MorseElement = n < 2 ? "dot" : "dash";
      const note = n === 1 || n === 3 ? undefined : `Mark of ${n} units at ${at} is not a clean dot (1) or dash (3); read as ${e}.`;
      tagged.push({ e, unit: i, ...(note ? { note } : {}) });
    } else {
      const e: MorseElement = n < 2 ? "symbolGap" : n < 5 ? "letterGap" : "wordGap";
      const clean = n === 1 || n === 3 || n === 7;
      const name = e === "symbolGap" ? "a gap inside a letter" : e === "letterGap" ? "a gap between letters" : "a gap between words";
      const note = clean ? undefined : `Space of ${n} units at ${at} is not a clean 1, 3 or 7; read as ${name}.`;
      tagged.push({ e, unit: i, ...(note ? { note } : {}) });
    }
    i += n;
  }
  return tagged;
}
