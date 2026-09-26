// Classical ciphers (packet section 22, task T13). Historical / puzzle ciphers,
// not modern security: every one of these can be broken by hand.
//
// Pipeline position: NORMALIZER -> CIPHER -> SYMBOL ENCODER. Text is already
// uppercase. Substitution ciphers change A-Z only and pass spaces, digits and
// punctuation through. Transposition ciphers move every character except
// spaces, which stay where they are: a knitted message cannot carry a space at
// its very start or end, or two in a row, so spaces must not travel.

export type CipherKind = "none" | "caesar" | "keyword" | "vigenere" | "railfence" | "route";

export interface CipherSettings {
  kind: CipherKind;
  key: string;
}

export const PUZZLE_LABEL = "Historical / puzzle cipher, not modern security.";

export const CIPHERS: Record<CipherKind, { name: string; keyLabel: string; keyHint: string; example: string }> = {
  none: { name: "None", keyLabel: "", keyHint: "", example: "" },
  caesar: { name: "Caesar shift", keyLabel: "SHIFT", keyHint: "A number: 3 turns A into D.", example: "3" },
  keyword: { name: "Keyword substitution", keyLabel: "KEYWORD", keyHint: "The keyword's letters start the cipher alphabet, then the rest in order.", example: "KNITTING" },
  vigenere: { name: "Vigenère", keyLabel: "KEY", keyHint: "Each key letter shifts one message letter in turn: A by 0, B by 1.", example: "DUPIN" },
  railfence: { name: "Rail fence", keyLabel: "RAILS", keyHint: "Write the message in a zigzag over this many rails, read rail by rail.", example: "3" },
  route: { name: "Route transposition", keyLabel: "WIDTH AND ROUTE", keyHint: "Write in rows of this width, read by a route: columns, snake or spiral. For example 5 spiral.", example: "5 spiral" },
};

const A = 65;
const isLetter = (ch: string) => ch >= "A" && ch <= "Z";
const shift = (ch: string, by: number) => String.fromCharCode(A + ((((ch.charCodeAt(0) - A + by) % 26) + 26) % 26));

/** Why a key is unusable, or null when it is fine. */
export function keyProblem(c: CipherSettings): string | null {
  const key = c.key.trim().toUpperCase();
  switch (c.kind) {
    case "none":
      return null;
    case "caesar":
      return /^-?\d+$/.test(key) ? null : "The shift must be a whole number, like 3.";
    case "keyword":
    case "vigenere":
      return /[A-Z]/.test(key) ? null : "The key needs at least one letter A to Z.";
    case "railfence": {
      const n = Number(key);
      return Number.isInteger(n) && n >= 2 && n <= 12 ? null : "Use 2 to 12 rails.";
    }
    case "route": {
      const m = /^(\d+)\s*(COLUMNS|SNAKE|SPIRAL)?$/.exec(key);
      return m && Number(m[1]) >= 2 && Number(m[1]) <= 40 ? null : 'Give a width from 2 to 40, then a route: columns, snake or spiral. For example "5 spiral".';
    }
  }
}

function keywordAlphabet(keyword: string): string {
  const seen = new Set<string>();
  for (const ch of keyword.toUpperCase() + "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (isLetter(ch)) seen.add(ch);
  return [...seen].join("");
}

function vigenere(text: string, key: string, dir: 1 | -1): string {
  const shifts = [...key.toUpperCase()].filter(isLetter).map((ch) => ch.charCodeAt(0) - A);
  let k = 0;
  return [...text].map((ch) => (isLetter(ch) ? shift(ch, dir * shifts[k++ % shifts.length]!) : ch)).join("");
}

/** Positions in the order a transposition reads them out. */
function railOrder(len: number, rails: number): number[] {
  const rows: number[][] = Array.from({ length: rails }, () => []);
  let r = 0;
  let step = 1;
  for (let i = 0; i < len; i++) {
    rows[r]!.push(i);
    if (rails > 1) {
      if (r === 0) step = 1;
      else if (r === rails - 1) step = -1;
      r += step;
    }
  }
  return rows.flat();
}

function routeOrder(len: number, width: number, route: string): number[] {
  const height = Math.ceil(len / width);
  const at = (r: number, c: number) => r * width + c;
  const out: number[] = [];
  const push = (r: number, c: number) => {
    if (at(r, c) < len) out.push(at(r, c));
  };
  if (route === "SPIRAL") {
    // Clockwise from the top left, over the full rectangle, skipping empty cells.
    let [top, bottom, left, right] = [0, height - 1, 0, width - 1];
    while (top <= bottom && left <= right) {
      for (let c = left; c <= right; c++) push(top, c);
      for (let r = top + 1; r <= bottom; r++) push(r, right);
      if (top < bottom) for (let c = right - 1; c >= left; c--) push(bottom, c);
      if (left < right) for (let r = bottom - 1; r > top; r--) push(r, left);
      [top, bottom, left, right] = [top + 1, bottom - 1, left + 1, right - 1];
    }
  } else {
    for (let c = 0; c < width; c++) {
      const down = route !== "SNAKE" || c % 2 === 0;
      for (let k = 0; k < height; k++) push(down ? k : height - 1 - k, c);
    }
  }
  return out;
}

function transposeOrder(len: number, c: CipherSettings): number[] {
  if (c.kind === "railfence") return railOrder(len, Number(c.key));
  const m = /^(\d+)\s*(COLUMNS|SNAKE|SPIRAL)?$/.exec(c.key.trim().toUpperCase())!;
  return routeOrder(len, Number(m[1]), m[2] ?? "COLUMNS");
}

export function encipher(text: string, c: CipherSettings): string {
  const problem = keyProblem(c);
  if (problem) throw new Error(problem);
  switch (c.kind) {
    case "none":
      return text;
    case "caesar":
      return [...text].map((ch) => (isLetter(ch) ? shift(ch, Number(c.key)) : ch)).join("");
    case "keyword": {
      const alpha = keywordAlphabet(c.key);
      return [...text].map((ch) => (isLetter(ch) ? alpha[ch.charCodeAt(0) - A]! : ch)).join("");
    }
    case "vigenere":
      return vigenere(text, c.key, 1);
    default:
      return transposeKeepingSpaces(text, (chars) => transposeOrder(chars.length, c).map((i) => chars[i]!));
  }
}

/** Apply a transposition to the non-space characters, leaving spaces in place. */
function transposeKeepingSpaces(text: string, move: (chars: string[]) => string[]): string {
  const all = [...text];
  const slots = all.flatMap((ch, i) => (ch === " " ? [] : [i]));
  const moved = move(slots.map((i) => all[i]!));
  slots.forEach((i, k) => (all[i] = moved[k]!));
  return all.join("");
}

export function decipher(text: string, c: CipherSettings): string {
  const problem = keyProblem(c);
  if (problem) throw new Error(problem);
  switch (c.kind) {
    case "none":
      return text;
    case "caesar":
      return [...text].map((ch) => (isLetter(ch) ? shift(ch, -Number(c.key)) : ch)).join("");
    case "keyword": {
      const alpha = keywordAlphabet(c.key);
      return [...text].map((ch) => (isLetter(ch) ? String.fromCharCode(A + alpha.indexOf(ch)) : ch)).join("");
    }
    case "vigenere":
      return vigenere(text, c.key, -1);
    default:
      return transposeKeepingSpaces(text, (chars) => {
        const out = new Array<string>(chars.length);
        transposeOrder(chars.length, c).forEach((from, k) => (out[from] = chars[k]!));
        return out;
      });
  }
}
