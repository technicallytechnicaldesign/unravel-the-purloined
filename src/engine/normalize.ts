// Normalizer (pipeline stage 1): uppercase, transliterate, strip accents, and
// report every character an alphabet cannot carry. Each symbol encoder passes
// its own test for what it carries.

export interface Dropped {
  char: string;
  /** Index in the input (by code point). */
  index: number;
}

export interface Normalized {
  text: string;
  /** Characters removed because the alphabet cannot carry them. */
  dropped: Dropped[];
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

/**
 * Normalize for one alphabet. With `spaces`, whitespace runs collapse to one
 * space; without, whitespace is reported as dropped like anything else.
 */
export function normalizeWith(input: string, carries: (ch: string) => boolean, spaces = true): Normalized {
  const dropped: Dropped[] = [];
  let out = "";
  Array.from(input.toUpperCase()).forEach((raw, index) => {
    const mapped =
      TRANSLITERATE[raw] ??
      // Strip combining accents: É -> E, Ü -> U.
      raw.normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const ch of mapped) {
      if (spaces && /\s/.test(ch)) {
        if (out.length > 0 && !out.endsWith(" ")) out += " ";
      } else if (carries(ch)) {
        out += ch;
      } else {
        dropped.push({ char: raw, index });
      }
    }
  });
  return { text: out.trimEnd(), dropped };
}
