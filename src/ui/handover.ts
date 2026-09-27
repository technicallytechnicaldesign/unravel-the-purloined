// Passing work between pages in the same tab: a pattern from the lab to the
// decoder, and the alphabet draft from the designer. Browser storage only; if
// it is blocked, the pattern goes as a downloaded file instead.

import { download } from "./h";
import { exportProject, type Project } from "../engine/project";
import { checkAlphabet, exportAlphabet, importAlphabet, type Alphabet } from "../engine/alphabet";

const PROJECT = "utp-handover-project";
const DRAFT = "utp-alphabet-draft";

/** Open the decoder page with this pattern loaded. */
export function sendToDecoder(p: Project): void {
  try {
    sessionStorage.setItem(PROJECT, exportProject(p));
    location.href = "./decode.html#from-lab";
  } catch {
    download("pattern.json", "application/json", exportProject(p));
    location.href = "./decode.html#open-file";
  }
}

/** The pattern handed over from the lab, once. */
export function takeProject(): string | undefined {
  try {
    const json = sessionStorage.getItem(PROJECT) ?? undefined;
    sessionStorage.removeItem(PROJECT);
    return json;
  } catch {
    return undefined;
  }
}

/** The alphabet being designed in this browser, if any. */
export function loadDraft(): Alphabet | undefined {
  try {
    const a = importAlphabet(localStorage.getItem(DRAFT) ?? "");
    return typeof a === "string" ? undefined : a;
  } catch {
    return undefined;
  }
}

export function saveDraft(a: Alphabet): void {
  try {
    localStorage.setItem(DRAFT, exportAlphabet(a));
  } catch {
    // Storage may be blocked; the designer works without it.
  }
}

/** The draft, only when it can be used to read letters. */
export const usableDraft = (): Alphabet | undefined => {
  const a = loadDraft();
  return a && Object.keys(a.symbols).length > 1 && checkAlphabet(a).usable ? a : undefined;
};
