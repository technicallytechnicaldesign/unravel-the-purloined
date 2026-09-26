// The parcel key (tasks S1, S3): everything a reader needs to find a hidden
// message again. It travels three ways: a JSON file, a short code to type, and
// a printed key card. Keep it apart from the knitting; whoever has both can
// read the message.

import { type CarrierId } from "./carrier";
import { type CipherKind, type CipherSettings, keyProblem } from "./ciphers";
import { type SymbolCode } from "./errorcontrol";
import { type MotifId, MOTIFS } from "./motifs";
import { type EncodingSettings } from "./project";
import { type FillerId, type HideSettings } from "./stego";

export const KEY_FORMAT = "unravel-the-purloined/key";

export interface ParcelKey {
  format: typeof KEY_FORMAT;
  version: 1;
  title?: string;
  hide: HideSettings;
  encoding: EncodingSettings;
  cipher?: CipherSettings;
  carrier: CarrierId;
  /** Border depth round the hidden block, in stitches. */
  border: number;
  /** Scatter: canvas size in cells. Motif: message grid size in tiles. */
  width: number;
  height: number;
  /** Scatter: number of message cells on the route. */
  length?: number;
}

// Short tokens for the typed code. Order in each table is fixed; do not reorder.
const FILLERS: Record<string, FillerId> = { TX: "texture", ST: "stockinette", GA: "garter", SE: "seed", DS: "double-seed", R1: "rib1", R2: "rib2", SA: "solid-a", SB: "solid-b", CH: "checker", SR: "stripes" };
const MOTIF_CODES: Record<string, MotifId> = { W: "window", D: "diamond", X: "cross" };
const CIPHER_CODES: Record<string, CipherKind> = { CA: "caesar", KW: "keyword", VI: "vigenere", RF: "railfence", RO: "route" };
const CARRIER_CODES: Record<string, CarrierId> = { PR: "purl-relief", TC: "two-colour", CA: "cable", LA: "lace", BO: "bobble", BE: "bead" };
const CODE_LETTER: Record<SymbolCode, string> = { plain: "N", parity: "P", hamming: "H" };
const flip = <T extends string>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k])) as Record<T, string>;

/** A cipher key as it goes in the code: shifts as 0 to 25, spaces as "_", nothing that could be read as a separator. */
function codeKey(c: CipherSettings): string {
  if (c.kind === "caesar") return String(((Number(c.key) % 26) + 26) % 26);
  return c.key.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, "_");
}

const check = (body: string) => ([...body].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 36).toString(36).toUpperCase();

/** The key as a short code, e.g. UTP1-MO-8X13-B0-PR-5N-W-NC-7. The last character catches typing slips. */
export function keyCode(k: ParcelKey): string {
  const e = k.encoding;
  const enc = e.alphabet === "morse" ? "MR" : e.alphabet === "bacon" ? `BA${e.variant === "historical24" ? 24 : 26}` : `5${CODE_LETTER[e.errorControl.code]}${e.errorControl.separator ? "S" : ""}${e.errorControl.checksum ? "K" : ""}`;
  const hide = k.hide.mode === "motif" ? flip(MOTIF_CODES)[k.hide.motif] : `${k.hide.seed.toString(36).toUpperCase()}.${k.hide.density}.${(k.length ?? 0).toString(36).toUpperCase()}.${flip(FILLERS)[k.hide.filler]}`;
  const cipher = k.cipher && k.cipher.kind !== "none" ? `${flip(CIPHER_CODES)[k.cipher.kind]}.${codeKey(k.cipher)}` : "NC";
  const body = ["UTP1", k.hide.mode === "motif" ? "MO" : "SC", `${k.width}X${k.height}`, `B${k.border}`, flip(CARRIER_CODES)[k.carrier] ?? "PR", enc, hide, cipher].join("-");
  return `${body}-${check(body)}`;
}

/** Read a typed code back into a key, or explain what is wrong with it. */
export function parseKeyCode(code: string): ParcelKey | string {
  const clean = code.trim().toUpperCase().replace(/\s+/g, "");
  const parts = clean.split("-");
  if (parts.length !== 9 || parts[0] !== "UTP1") return "This does not look like a parcel key code. It starts with UTP1 and has nine parts separated by dashes.";
  const body = parts.slice(0, 8).join("-");
  if (check(body) !== parts[8]) return "The last character does not match: a letter may have been mistyped.";
  const [, mode, dims, border, carrier, enc, hide, cipher] = parts as [string, string, string, string, string, string, string, string];
  const dm = /^(\d+)X(\d+)$/.exec(dims);
  const bm = /^B(\d+)$/.exec(border);
  if (!dm || !bm) return "The size or border part of the code is not readable.";

  let encoding: EncodingSettings;
  if (enc === "MR") encoding = { alphabet: "morse" };
  else if (enc === "BA24" || enc === "BA26") encoding = { alphabet: "bacon", variant: enc === "BA24" ? "historical24" : "modern26" };
  else {
    const em = /^5([NPH])(S?)(K?)$/.exec(enc);
    if (!em) return "The alphabet part of the code is not readable.";
    const codeOf = Object.entries(CODE_LETTER).find(([, l]) => l === em[1])![0] as SymbolCode;
    encoding = { alphabet: "fivebit", errorControl: { code: codeOf, separator: em[2] === "S", checksum: em[3] === "K" } };
  }

  let hideSettings: HideSettings;
  let length: number | undefined;
  if (mode === "MO") {
    const motif = MOTIF_CODES[hide];
    if (!motif) return "The motif part of the code is not readable.";
    hideSettings = { mode: "motif", motif };
  } else if (mode === "SC") {
    const hm = /^([0-9A-Z]+)\.([234])\.([0-9A-Z]+)\.([A-Z0-9]{2})$/.exec(hide);
    const filler = hm ? FILLERS[hm[4]!] : undefined;
    if (!hm || !filler) return "The scatter part of the code is not readable.";
    hideSettings = { mode: "scatter", seed: parseInt(hm[1]!, 36), density: Number(hm[2]) as 2 | 3 | 4, filler };
    length = parseInt(hm[3]!, 36);
  } else return "The code does not say whether the message is scattered or in motifs.";

  let cipherSettings: CipherSettings | undefined;
  if (cipher !== "NC") {
    const [kindCode, ...rest] = cipher.split(".");
    const kind = CIPHER_CODES[kindCode!];
    if (!kind) return "The cipher part of the code is not readable.";
    cipherSettings = { kind, key: rest.join(".").replace(/_/g, " ") };
    if (keyProblem(cipherSettings)) return `The cipher key in the code does not work: ${keyProblem(cipherSettings)}`;
  }

  return {
    format: KEY_FORMAT,
    version: 1,
    hide: hideSettings,
    encoding,
    ...(cipherSettings ? { cipher: cipherSettings } : {}),
    carrier: CARRIER_CODES[carrier] ?? "purl-relief",
    border: Number(bm[1]),
    width: Number(dm[1]),
    height: Number(dm[2]),
    ...(length !== undefined ? { length } : {}),
  };
}

export const exportKey = (k: ParcelKey): string => JSON.stringify(k, null, 2);

/** Read a key file, checking it is one; or explain why not. */
export function importKey(json: string): ParcelKey | string {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return "This file is not valid JSON.";
  }
  const k = data as Partial<ParcelKey> | null;
  if (!k || k.format !== KEY_FORMAT) return "This is not a parcel key file.";
  if (k.version !== 1) return `Key version ${String(k.version)} is not supported.`;
  if (!k.hide || !k.encoding || !k.width || !k.height) return "The key file is missing parts it needs.";
  // Round-trip through the code, which checks every part.
  const again = parseKeyCode(keyCode(k as ParcelKey));
  return typeof again === "string" ? again : { ...again, ...(k.title ? { title: k.title } : {}) };
}

/** The key in words, for the printed card and the decoder. */
export function describeKey(k: ParcelKey): string[] {
  const e = k.encoding;
  const alphabet = e.alphabet === "morse" ? "Morse code" : e.alphabet === "bacon" ? `Bacon's ${e.variant === "historical24" ? "24" : "26"}-letter alphabet` : `the five-bit alphabet (${e.errorControl.code === "plain" ? "no check cell" : e.errorControl.code === "parity" ? "a parity cell" : "Hamming"} per letter${e.errorControl.separator ? ", separators" : ""}${e.errorControl.checksum ? ", checksum" : ""})`;
  const lines = [
    k.hide.mode === "motif"
      ? `Hidden in motifs: ${MOTIFS[k.hide.motif].name}. ${MOTIFS[k.hide.motif].reading} The tiles form a grid of ${k.width} by ${k.height}, read like any chart from the lab: marker row at the bottom, right to left, bottom up.`
      : `Scattered: ${k.length} message cells along a route set by seed ${k.hide.seed}, over a field ${k.width} stitches wide and ${k.height} rows tall, with ${k.hide.filler === "texture" ? "random texture" : k.hide.filler} as filler.`,
    `Border: ${k.border} stitch${k.border === 1 ? "" : "es"} deep; ignore it.`,
    `${k.carrier === "two-colour" ? "Colour B is 1" : k.carrier === "purl-relief" ? "A purl stitch is 1" : `Each ${k.carrier} block is one cell; mark it as 1 or 0 by the key in the pattern`}. The message is written in ${alphabet}.`,
    k.cipher && k.cipher.kind !== "none" ? `Then decipher: ${k.cipher.kind}, key ${k.cipher.key.toUpperCase()}. A historical / puzzle cipher.` : "No cipher.",
  ];
  return lines;
}
