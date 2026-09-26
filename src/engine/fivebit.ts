// Five-bit alphabet: the core fixed-width symbol encoder (packet section 27.2).
//
// Pipeline position: NORMALIZER -> (cipher) -> SYMBOL ENCODER. This module knows
// nothing about knitting. It turns text into bits and bits back into text; a
// carrier decides later what a 0 or a 1 looks like in yarn.
//
// Value table (A = 00000, so the packet's worked example holds:
// K P K P P -> 0 1 0 1 1 -> 11 -> L):
//   0..25  A..Z
//   26     space
//   27     full stop
//   28     START control
//   29     END control
//   30     question mark
//   31     reserved (future shift/escape)

export type Bit = 0 | 1;

export const BITS_PER_SYMBOL = 5;

export const START = "\u0002"; // control symbol, value 28
export const END = "\u0003"; // control symbol, value 29

const EXTRA: Record<number, string> = { 26: " ", 27: ".", 28: START, 29: END, 30: "?" };

const VALUE_TO_CHAR: string[] = [];
for (let v = 0; v < 26; v++) VALUE_TO_CHAR[v] = String.fromCharCode(65 + v);
for (const [v, ch] of Object.entries(EXTRA)) VALUE_TO_CHAR[Number(v)] = ch;

const CHAR_TO_VALUE = new Map<string, number>(VALUE_TO_CHAR.map((ch, v) => [ch, v]));

export interface Normalized {
  text: string;
  /** Characters removed because the alphabet cannot carry them, with their index in the input. */
  dropped: { char: string; index: number }[];
}

// Letters outside A-Z that have an honest plain-Latin spelling. Norwegian and
// Danish letters matter here: the history pages start in Norway.
const TRANSLITERATE: Record<string, string> = {
  "Æ": "AE",
  "Ø": "OE",
  "Å": "AA",
  "ß": "SS",
  "Œ": "OE",
};

/** Uppercase, transliterate, collapse whitespace, and report anything the alphabet cannot carry. */
export function normalize(input: string): Normalized {
  const dropped: Normalized["dropped"] = [];
  let out = "";
  const chars = Array.from(input.toUpperCase());
  chars.forEach((raw, index) => {
    const mapped =
      TRANSLITERATE[raw] ??
      // Strip combining accents: É -> E, Ü -> U.
      raw.normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const ch of mapped) {
      if (/\s/.test(ch)) {
        if (out.length > 0 && !out.endsWith(" ")) out += " ";
      } else if (CHAR_TO_VALUE.has(ch) && ch !== START && ch !== END) {
        out += ch;
      } else {
        dropped.push({ char: raw, index });
      }
    }
  });
  return { text: out.trimEnd(), dropped };
}

/** Encode already-normalized text to a flat bit stream, most significant bit first. */
export function encode(text: string): Bit[] {
  const bits: Bit[] = [];
  for (const ch of text) {
    const value = CHAR_TO_VALUE.get(ch);
    if (value === undefined) {
      throw new Error(`Character ${JSON.stringify(ch)} is not in the five-bit alphabet; normalize first.`);
    }
    for (let i = BITS_PER_SYMBOL - 1; i >= 0; i--) bits.push(((value >> i) & 1) as Bit);
  }
  return bits;
}

export interface DecodeResult {
  text: string;
  /** Symbol indexes (0-based) whose value has no character, e.g. the reserved value 31. */
  invalidSymbols: number[];
  /** Bits left over after the last whole symbol; non-zero means a framing or count error. */
  trailingBits: number;
}

/** Decode a bit stream back to text, reporting problems instead of throwing. */
export function decode(bits: readonly Bit[]): DecodeResult {
  let text = "";
  const invalidSymbols: number[] = [];
  const whole = Math.floor(bits.length / BITS_PER_SYMBOL);
  for (let s = 0; s < whole; s++) {
    let value = 0;
    for (let i = 0; i < BITS_PER_SYMBOL; i++) value = (value << 1) | bits[s * BITS_PER_SYMBOL + i]!;
    const ch = VALUE_TO_CHAR[value];
    if (ch === undefined) invalidSymbols.push(s);
    else text += ch;
  }
  return { text, invalidSymbols, trailingBits: bits.length - whole * BITS_PER_SYMBOL };
}
