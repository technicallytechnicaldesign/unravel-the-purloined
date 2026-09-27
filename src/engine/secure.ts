// Secure mode (packet phase 6): real encryption, kept apart from the historical
// ciphers. Only the browser's Web Crypto API, only established primitives:
//
//   key   = PBKDF2(passphrase, salt, SHA-256, 600 000 rounds) -> AES-256 key
//   bytes = [version 1] [salt 16] [nonce 12] [AES-GCM ciphertext + 16-byte tag]
//
// The version byte is also the GCM additional data, so it cannot be changed
// unnoticed. Nothing is invented here and nothing leaves the browser.
//
// To knit the bytes, each one becomes two letters from A to P (one per half
// byte). The letters then go through the ordinary five-bit alphabet, so the
// framing, parity or Hamming codes and the checksum all still apply. That
// matters: AES-GCM refuses the whole message if a single cell is wrong.

export const SECURE_VERSION = 1;
export const PBKDF2_ROUNDS = 600_000;
const SALT = 16;
const NONCE = 12;
const TAG = 16;
/** Bytes added to every message: version, salt, nonce and tag. */
export const OVERHEAD = 1 + SALT + NONCE + TAG;

export const SECURE_LABEL = "Modern encryption (AES-GCM, key from your passphrase by PBKDF2). The passphrase is the whole secret: anyone who has it or guesses it can read the message. Nothing leaves this browser.";

const LETTERS = "ABCDEFGHIJKLMNOP";

const subtle = (): SubtleCrypto => {
  if (!globalThis.crypto?.subtle) throw new Error("This browser has no Web Crypto, so secure mode cannot run here.");
  return globalThis.crypto.subtle;
};

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Encrypt text (any characters, as UTF-8) with a fresh random salt and nonce. */
export async function encrypt(text: string, passphrase: string): Promise<Uint8Array> {
  if (!passphrase) throw new Error("Type a passphrase.");
  const salt = crypto.getRandomValues(new Uint8Array(SALT));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE));
  const head = new Uint8Array([SECURE_VERSION]);
  const key = await deriveKey(passphrase, salt);
  const sealed = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv: nonce, additionalData: head }, key, new TextEncoder().encode(text)));
  const out = new Uint8Array(OVERHEAD - TAG + sealed.length);
  out.set(head, 0);
  out.set(salt, 1);
  out.set(nonce, 1 + SALT);
  out.set(sealed, 1 + SALT + NONCE);
  return out;
}

export type DecryptResult = { ok: true; text: string } | { ok: false; message: string };

/** Decrypt, or say plainly why not. GCM cannot tell a wrong passphrase from a changed byte. */
export async function decrypt(bytes: Uint8Array, passphrase: string): Promise<DecryptResult> {
  if (bytes.length < OVERHEAD) return { ok: false, message: `Too short: secure messages are at least ${OVERHEAD} bytes (${OVERHEAD * 2} letters), this one is ${bytes.length}.` };
  if (bytes[0] !== SECURE_VERSION) return { ok: false, message: `Unknown secure format ${bytes[0]}; this lab reads format ${SECURE_VERSION}. The first two letters may have been misread.` };
  if (!passphrase) return { ok: false, message: "Type the passphrase." };
  const key = await deriveKey(passphrase, bytes.slice(1, 1 + SALT));
  try {
    const plain = await subtle().decrypt({ name: "AES-GCM", iv: bytes.slice(1 + SALT, 1 + SALT + NONCE), additionalData: bytes.slice(0, 1) }, key, bytes.slice(1 + SALT + NONCE));
    return { ok: true, text: new TextDecoder().decode(plain) };
  } catch {
    return { ok: false, message: "The passphrase is wrong, or at least one letter was misread. AES-GCM cannot say which: it only knows the message is not the one that was sealed. Check the error report above, then the passphrase." };
  }
}

/** Two letters per byte, high half first: 0x00 is AA, 0xFF is PP. */
export const toLetters = (bytes: Uint8Array): string => [...bytes].map((b) => LETTERS[b >> 4]! + LETTERS[b & 15]!).join("");

export interface LetterIssue {
  /** 1-based character position in the text. */
  at: number;
  message: string;
}

/** Letters back to bytes. Spaces are skipped; anything outside A to P, or an odd count, is reported. */
export function fromLetters(text: string): { bytes: Uint8Array; issues: LetterIssue[] } {
  const issues: LetterIssue[] = [];
  const halves: number[] = [];
  [...text].forEach((ch, i) => {
    if (ch === " ") return;
    const v = LETTERS.indexOf(ch.toUpperCase());
    if (v < 0) issues.push({ at: i + 1, message: `Character ${i + 1} is "${ch}", which secure letters never use (only A to P); possible error near character ${i + 1}.` });
    else halves.push(v);
  });
  if (halves.length % 2) issues.push({ at: text.length, message: `${halves.length} letters is an odd count; every byte is two letters, so one is missing or extra.` });
  const bytes = new Uint8Array(halves.length >> 1);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (halves[2 * i]! << 4) | halves[2 * i + 1]!;
  return { bytes, issues };
}

/** Size of the knitted letters for a message, before any error checks. */
export const letterCount = (text: string): number => 2 * (OVERHEAD + new TextEncoder().encode(text).length);
