// Bacon's biliteral alphabet (packet sections 22.7, 27.3): each letter is five
// A/B choices. A = 0, B = 1 here; a carrier decides what A and B look like.
// This is a historical / puzzle cipher, not modern security.
//
// Two alphabets:
//   historical24: Bacon's 24 letters, I/J share a code and U/V share a code.
//   modern26:     every letter its own code, A = AAAAA ... Z = BBAAB.

import { type Bit, BITS_PER_SYMBOL } from "./fivebit";
import { normalizeWith, type Dropped } from "./normalize";

export type BaconAlphabet = "historical24" | "modern26";

/** What the UI must show so readers know which alphabet is in use. */
export const ALPHABET_LABEL: Record<BaconAlphabet, string> = {
  historical24: "Historical 24-letter alphabet: I and J share a code, U and V share a code.",
  modern26: "Modern 26-letter alphabet: every letter has its own code.",
};

const LETTERS: Record<BaconAlphabet, string> = {
  historical24: "ABCDEFGHIKLMNOPQRSTUWXYZ",
  modern26: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
};

/** Letters the historical alphabet folds into another. */
const MERGE: Record<string, string> = { J: "I", V: "U" };

export interface BaconNormalized {
  text: string;
  alphabet: BaconAlphabet;
  /** Spaces, digits and punctuation: Bacon's alphabet has no code for them. */
  dropped: Dropped[];
  /** Historical mode only: letters written with a shared code. */
  merged: { char: string; as: string; position: number }[];
}

/** Letters only; spaces are reported as dropped because the alphabet has none. */
export function normalize(input: string, alphabet: BaconAlphabet): BaconNormalized {
  const { text, dropped } = normalizeWith(input, (ch) => ch >= "A" && ch <= "Z", false);
  const merged: BaconNormalized["merged"] = [];
  let out = "";
  Array.from(text).forEach((ch, i) => {
    const as = alphabet === "historical24" ? MERGE[ch] : undefined;
    if (as) merged.push({ char: ch, as, position: i + 1 });
    out += as ?? ch;
  });
  return { text: out, alphabet, dropped, merged };
}

/** Encode normalized letters to bits, five per letter, most significant first. */
export function encode(text: string, alphabet: BaconAlphabet): Bit[] {
  const bits: Bit[] = [];
  for (const ch of text) {
    const v = LETTERS[alphabet].indexOf(ch);
    if (v < 0) throw new Error(`${JSON.stringify(ch)} is not in the ${alphabet} alphabet; normalize first.`);
    for (let i = BITS_PER_SYMBOL - 1; i >= 0; i--) bits.push(((v >> i) & 1) as Bit);
  }
  return bits;
}

/** Bits as Bacon wrote them: groups of five A/B letters. */
export function toAB(bits: readonly Bit[]): string {
  const ab = bits.map((b) => (b ? "B" : "A")).join("");
  return ab.match(/.{1,5}/g)?.join(" ") ?? "";
}

export interface BaconDecodeResult {
  text: string;
  alphabet: BaconAlphabet;
  label: string;
  /** Group indexes (0-based) whose code has no letter in this alphabet. */
  invalidGroups: number[];
  /** Historical mode: 1-based positions where the letter could be either of two. */
  ambiguous: { position: number; letters: string }[];
  /** Bits left over after the last whole group. */
  trailingBits: number;
}

/** Decode bits; unknown codes become U+FFFD and are listed, never dropped. */
export function decode(bits: readonly Bit[], alphabet: BaconAlphabet): BaconDecodeResult {
  const letters = LETTERS[alphabet];
  const invalidGroups: number[] = [];
  const ambiguous: BaconDecodeResult["ambiguous"] = [];
  let text = "";
  const whole = Math.floor(bits.length / BITS_PER_SYMBOL);
  for (let g = 0; g < whole; g++) {
    let v = 0;
    for (let i = 0; i < BITS_PER_SYMBOL; i++) v = (v << 1) | bits[g * BITS_PER_SYMBOL + i]!;
    const ch = letters[v];
    if (ch === undefined) {
      invalidGroups.push(g);
      text += "�";
      continue;
    }
    if (alphabet === "historical24") {
      const other = Object.keys(MERGE).find((k) => MERGE[k] === ch);
      if (other) ambiguous.push({ position: g + 1, letters: ch + other });
    }
    text += ch;
  }
  return {
    text,
    alphabet,
    label: ALPHABET_LABEL[alphabet],
    invalidGroups,
    ambiguous,
    trailingBits: bits.length - whole * BITS_PER_SYMBOL,
  };
}
