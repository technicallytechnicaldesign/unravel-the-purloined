// T10 manual grid decoder: click cells as knit/purl or colour A/B, see every
// step from cells to text, with errors pointed at the cells they are about.

import { h } from "./h";
import { carrierControls, cipherControls, encodingControls, field, secureControls } from "./controls";
import { decrypt, fromLetters } from "../engine/secure";
import { borderOf, unframe } from "../engine/grid";
import { readGlyphs } from "../engine/glyphs";
import { readStripes } from "../engine/stripes";
import * as morse from "../engine/morse";
import { describeKey, importKey, parseKeyCode, type ParcelKey } from "../engine/key";
import { decodeWithKey } from "../engine/unhide";
import { MOTIFS } from "../engine/motifs";
import { decipher } from "../engine/ciphers";
import { decodeCells } from "../engine/steps";
import { importProject, packFor, type Project } from "../engine/project";
import { checkAlphabet, importAlphabet, parseAlphabetCode, type Alphabet } from "../engine/alphabet";
import { type Bit } from "../engine/fivebit";
import { cellGrid } from "./cellgrid";
import { photoReader } from "./photoread";
import { stepsView } from "./stepsview";

const MAX = 60;

/** Parse typed rows, top row first: 0 . - or space-free "k" for 0; 1 x * • or "p" for 1. */
export function parseRows(text: string): Bit[][] | string {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[\s,|]/g, "")).filter(Boolean);
  if (!lines.length) return "Type at least one row.";
  const rows: Bit[][] = [];
  for (const [i, line] of lines.entries()) {
    const row: Bit[] = [];
    for (const ch of line.toLowerCase()) {
      if ("0.-k".includes(ch)) row.push(0);
      else if ("1x*•p".includes(ch)) row.push(1);
      else return `Line ${i + 1}: "${ch}" is not a cell. Use 0 or . for knit / colour A, 1 or x for purl / colour B.`;
    }
    rows.push(row);
  }
  if (rows.some((r) => r.length !== rows[0]!.length)) return `Every line needs the same number of cells; line 1 has ${rows[0]!.length}.`;
  if (rows[0]!.length > MAX || rows.length > MAX) return `Up to ${MAX} cells by ${MAX} rows.`;
  return rows.reverse(); // row 0 is the bottom
}

export function mountDecoder(root: HTMLElement): { load(p: Project): void; loadJson(json: string): void; useAlphabet(a: Alphabet, choose?: boolean): void; note(text: string): void } {
  const width = h("input", { type: "number", value: 8, min: 3, max: MAX, inputmode: "numeric" });
  const height = h("input", { type: "number", value: 8, min: 2, max: MAX, inputmode: "numeric" });
  const border = h("input", { type: "number", name: "border-depth", value: 0, min: 0, max: 8, inputmode: "numeric" });
  const depth = () => Math.max(0, Math.min(8, Math.round(Number(border.value)) || 0));
  const out = h("div");
  const message = h("p.hint", { role: "status" });

  let key: ParcelKey | undefined;
  const keyStatus = h("p.hint", { role: "status" }, "No key open. Without one, the decoder reads ordinary grids from the lab.");

  // Secure mode: the decoded letters go back to bytes and through AES-GCM. Decrypting is async
  // and slow on purpose, so it waits for clicks and typing to pause; the newest request wins.
  let ticket = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const decryptStep = (letters: string): HTMLElement => {
    const result = h("div", { role: "status" }, h("p.hint", {}, "Opening..."));
    const el = h("ol.steps", {}, h("li.step", {}, h("h3.step-title", {}, h("span.step-n.mono", {}, "06"), " Decrypt (AES-GCM)"), result));
    const { bytes, issues } = fromLetters(letters);
    const mine = ++ticket;
    clearTimeout(pending);
    pending = setTimeout(async () => {
      const r = await decrypt(bytes, sec.passphrase());
      if (mine !== ticket) return;
      result.replaceChildren(
        ...issues.map((i) => h("p.error.mono", {}, i.message)),
        r.ok ? h("p.mono.big", {}, r.text || "(empty)") : h("p.error", {}, r.message),
        h("p.hint", {}, r.ok ? "Sealed and opened intact: not one letter changed since it was encrypted." : "Nothing is shown until every letter is right and the passphrase matches."),
      );
    }, 400);
    return el;
  };

  // Cells a photo reading was unsure of, kept marked until another grid comes in.
  let doubt: [number, number][] = [];
  const decode = () => {
    cip.el.hidden = sec.on();
    grid.unmark("doubt");
    grid.mark(doubt, "doubt");
    if (key) {
      const s = decodeWithKey(grid.get(), key);
      out.replaceChildren(
        stepsView(s, key.encoding, grid),
        sec.on() ? decryptStep(s.text) : "",
        s.deciphered !== undefined
          ? h("ol.steps", {}, h("li.step", {}, h("h3.step-title", {}, h("span.step-n.mono", {}, "06"), " Decipher"), h("p.mono.big", {}, s.deciphered || "(nothing yet)"), h("p.hint", {}, "With the cipher and key from the parcel key.")))
          : "",
      );
      return;
    }
    const cipher = sec.on() ? undefined : cip.get();
    const glyphs = enc.glyphs();
    if (glyphs || car.get().id === "stripes") {
      grid.unmark("flag");
      const r = glyphs ? readGlyphsFrom(packFor(glyphs)) : readStripesFrom();
      out.replaceChildren(simpleSteps(r, cipher), sec.on() ? decryptStep(r.text) : "");
      return;
    }
    const s = decodeCells(grid.get(), depth(), enc.get());
    out.replaceChildren(
      stepsView(s, enc.get(), grid),
      sec.on() ? decryptStep(s.text) : "",
      cipher
        ? h(
            "ol.steps",
            {},
            h("li.step", {}, h("h3.step-title", {}, h("span.step-n.mono", {}, "06"), " Decipher"), h("p.mono.big", {}, decipher(s.text, cipher) || "(nothing yet)"), h("p.hint", {}, "The message above, run back through the cipher and key you chose.")),
          )
        : "",
    );
  };
  const step = (n: number, name: string, ...body: (Node | string)[]) => h("li.step", {}, h("h3.step-title", {}, h("span.step-n.mono", {}, String(n).padStart(2, "0")), ` ${name}`), ...body);
  /** Letters and stripes have no marker row or error checks; read them directly and list what did not fit. */
  const readGlyphsFrom = (pack: Parameters<typeof readGlyphs>[1]) => {
    const r = readGlyphs(unframe(grid.get(), depth()), pack);
    // Note cells are in reading coordinates; only mark them when the fabric was read as knitted.
    const o = r.orientation;
    if (!o.rotated180 && !o.mirrored) grid.mark(r.notes.flatMap((n) => n.cells.map(([row, c]): [number, number] => [row + depth(), c + depth()])), "flag");
    return { how: `Read as letters, ${r.orientation.rotated180 ? "turned" : "as knitted"}${r.orientation.mirrored ? ", mirrored" : ""}${r.orientation.inverted ? ", colours swapped" : ""}.`, text: r.text, notes: r.notes.map((n) => n.message) };
  };
  const readStripesFrom = () => {
    const r = readStripes(unframe(grid.get(), depth()));
    const m = morse.decodeUnits(r.units);
    return { how: `Read as stripes from the cast-on edge: ${r.units.join("")}`, text: m.text, notes: r.notes.map((n) => n.message) };
  };
  const simpleSteps = (r: { how: string; text: string; notes: string[] }, cipher: ReturnType<typeof cip.get>) =>
    h(
      "ol.steps",
      {},
      step(1, "Read", h("p.mono.bits", {}, r.how)),
      step(2, "Message", h("p.mono.big", {}, r.text || "(nothing yet)"), ...r.notes.map((n) => h("p.error.mono", {}, n))),
      cipher ? step(3, "Decipher", h("p.mono.big", {}, decipher(r.text, cipher) || "(nothing yet)")) : "",
    );
  const grid = cellGrid({ cells: Array.from({ length: 8 }, () => new Array<Bit>(8).fill(0)), label: "Grid to decode", onChange: () => decode() });

  const resize = () => {
    const cells = grid.get();
    const w = Math.min(MAX, Math.max(3, Math.round(Number(width.value)) || 3));
    const ht = Math.min(MAX, Math.max(2, Math.round(Number(height.value)) || 2));
    grid.set(Array.from({ length: ht }, (_, r) => Array.from({ length: w }, (_, c) => cells[r]?.[c] ?? 0)));
  };

  const enc = encodingControls(decode);
  const cip = cipherControls(decode);
  const sec = secureControls(decode, "The letters are read first, with every error check; only then does the passphrase open them.");
  const colourGrid = (id: string) => id === "two-colour" || id === "stripes";
  const car = carrierControls(() => (grid.setColour(colourGrid(car.get().id)), decode()), false);
  width.addEventListener("change", resize);
  height.addEventListener("change", resize);
  border.addEventListener("input", decode);

  const typed = h("textarea", { rows: 6, spellcheck: "false", placeholder: "Top row first. 0 or . = knit / A, 1 or x = purl / B\n1111111\n0110100\n1101000" });
  const pasted = h("textarea", { rows: 4, spellcheck: "false", placeholder: "Paste a downloaded project file here" });
  const file = h("input", { type: "file", accept: "application/json,.json" });
  const keyCode = h("input", { type: "text", name: "key-code", placeholder: "UTP1-...", spellcheck: "false", autocomplete: "off", "aria-label": "Parcel key code" });
  const alphaCode = h("input", { type: "text", name: "alphabet-code", placeholder: "UTPA1-...", spellcheck: "false", autocomplete: "off", "aria-label": "Alphabet share code" });
  const alphaFile = h("input", { type: "file", accept: "application/json,.json", "aria-label": "Alphabet file" });
  /** Take an alphabet from a code or a file's text, and read letters with it if it can be used. */
  const useAlphabetText = (text: string) => {
    const a = text.trim().startsWith("{") ? importAlphabet(text) : parseAlphabetCode(text);
    if (typeof a === "string") return void (message.textContent = a);
    const problem = checkAlphabet(a).findings.find((f) => f.severity === "problem");
    if (problem) return void (message.textContent = `This alphabet cannot be read with yet: ${problem.message}`);
    enc.setCustom(a);
    decode();
    message.textContent = `Reading with "${a.name}". Mark the stitches as usual.`;
  };
  alphaFile.addEventListener("change", async () => {
    const f = alphaFile.files?.[0];
    if (f) useAlphabetText(await f.text());
  });
  const keyFile = h("input", { type: "file", accept: "application/json,.json", "aria-label": "Parcel key file" });
  keyFile.addEventListener("change", async () => {
    const f = keyFile.files?.[0];
    if (f) useKey(importKey(await f.text()));
  });

  const setCells = (next: Bit[][], doubtful: [number, number][] = []) => {
    doubt = doubtful;
    width.value = String(next[0]!.length);
    height.value = String(next.length);
    grid.set(next);
  };

  /** Open a key: the grid takes the key's size, and decoding goes through it. */
  const useKey = (k: ParcelKey | string) => {
    if (typeof k === "string") {
      keyStatus.textContent = k;
      return;
    }
    key = k;
    const size = k.hide.mode === "motif" ? MOTIFS[k.hide.motif].size : 1;
    const w = k.width * size + 2 * k.border;
    const ht = k.height * size + 2 * k.border;
    const cells = grid.get();
    if (cells.length !== ht || cells[0]!.length !== w) setCells(Array.from({ length: ht }, () => new Array<Bit>(w).fill(0)));
    border.value = String(k.border);
    grid.setColour(k.carrier === "two-colour");
    keyStatus.replaceChildren(h("span.stamp.stamp-small", {}, "KEY OPEN"), ` ${k.title ? `"${k.title}": ` : ""}`, ...describeKey(k).map((l) => h("span.hint", {}, l)));
    decode();
  };
  const forgetKey = () => {
    key = undefined;
    keyStatus.textContent = "Key put away. The decoder reads ordinary grids again.";
    decode();
  };

  const load = (p: Project) => {
    choose("file", false, location.hash === "#from-lab" ? "OPENED FROM THE LAB " : undefined);
    enc.set(p.settings.encoding, p.settings.glyphs);
    cip.set(p.settings.cipher);
    sec.set(!!p.settings.secure);
    car.set(p.settings.carrier.id);
    grid.setColour(colourGrid(p.settings.carrier.id));
    border.value = String(borderOf(p.settings.layout));
    setCells(p.output.logicalGrid.map((r) => [...r]));
    if (p.output.key) useKey(p.output.key);
    else if (key) forgetKey();
    message.textContent = `Loaded "${p.settings.title}". ${p.settings.secure ? "It is sealed: type the passphrase under secure mode. " : ""}Click cells to add mistakes and watch the report.`;
  };

  const loadJson = (json: string) => {
    const r = importProject(json);
    if (r.project) load(r.project);
    message.textContent = [...r.issues, r.project ? message.textContent : ""].filter(Boolean).join(" ");
  };
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (f) loadJson(await f.text());
  });

  // Blocks of the page. Each path below shows only the ones its starting point needs.
  const size = h("div.controls", {}, h("div.control-group", {}, h("div.pair", {}, field("STITCHES PER ROW", width), field("ROWS", height)), field("BORDER DEPTH", border, "Stitches of border on each side; 0 for none. What the border holds does not matter.")));
  const settings = h("div", {}, h("p.field-label.mono", {}, "HOW IT WAS MADE"), h("div.controls", {}, car.el, enc.el, cip.el));
  const typedBox = h(
    "details.more",
    {},
    h("summary.mono", {}, "TYPE ROWS"),
    typed,
    h(
      "button.btn",
      {
        type: "button",
        onclick: () => {
          const r = parseRows(typed.value);
          if (typeof r === "string") message.textContent = r;
          else (setCells(r), (message.textContent = `${r.length} rows loaded.`));
        },
      },
      "Use these rows",
    ),
  );
  const photoBox = photoReader({
    size: () => [grid.get()[0]!.length, grid.get().length],
    colour: () => colourGrid(car.get().id),
    border: depth,
    apply: (cells, doubtful) => setCells(cells, doubtful),
  });
  const keyBox = h(
    "div",
    {},
    h(
      "details.more",
      {},
      h("summary.mono", {}, "OPEN A PARCEL KEY"),
      h("p.hint", {}, "For hidden messages. Type the code from a key card, or open a key file. The key sets the size and how the piece was made."),
      keyCode,
      h("div.actions", {}, h("button.btn", { type: "button", onclick: () => useKey(parseKeyCode(keyCode.value)) }, "Use this code"), h("button.btn", { type: "button", onclick: forgetKey }, "Put the key away")),
      keyFile,
    ),
    keyStatus,
  );
  const alphaBox = h(
    "details.more",
    {},
    h("summary.mono", {}, "OPEN AN ALPHABET"),
    h("p.hint", {}, "For pieces knitted in someone's own alphabet. Paste their share code, or open their alphabet file."),
    alphaCode,
    h("div.actions", {}, h("button.btn", { type: "button", onclick: () => useAlphabetText(alphaCode.value) }, "Use this code")),
    alphaFile,
  );
  const fileBox = h(
    "details.more",
    {},
    h("summary.mono", {}, "OPEN A PROJECT FILE"),
    h("p.hint", {}, "A pattern saved from the lab. It brings its own settings and grid."),
    file,
    pasted,
    h("button.btn", { type: "button", onclick: () => loadJson(pasted.value) }, "Open pasted project"),
  );
  const gridBox = h(
    "div",
    {},
    h("p.field-label.mono", {}, "THE GRID"),
    h("p.hint", {}, "Mark each cell as you see it on the right side, row 1 at the bottom. Which way up does not matter: the marker row tells the decoder."),
    h("div.actions", {}, h("button.btn", { type: "button", onclick: () => setCells(grid.get().map((r) => r.map(() => 0 as Bit))) }, "Clear")),
    h("div.scroll", {}, grid.el),
  );

  // "I have a..." paths, as in the lab. The first block listed is opened and focused.
  type Path = keyof typeof PATHS;
  const PATHS = {
    piece: { have: "a knitted piece", how: "Count the stitches, then mark each one on a grid.", show: [size, settings, gridBox] },
    photo: { have: "a photo of one", how: "Place four corners and let the page read the cells.", show: [photoBox, settings, size, gridBox] },
    rows: { have: "rows written down", how: "Type 0s and 1s (or dots and crosses), top row first.", show: [typedBox, settings, gridBox] },
    key: { have: "a parcel key", how: "A code or key file for a message hidden in a pattern.", show: [keyBox, gridBox] },
    alphabet: { have: "someone's alphabet", how: "Their share code or file, for a piece in their own letters.", show: [alphaBox, size, settings, gridBox] },
    file: { have: "a pattern file", how: "A project saved from the lab, with its settings inside.", show: [fileBox, settings, gridBox] },
  };
  const blocks = [photoBox, typedBox, keyBox, alphaBox, fileBox, size, settings, gridBox];
  const pathNote = h("p.path-note.mono", { hidden: true });
  const paths = h(
    "div.paths",
    { role: "group", "aria-label": "What do you have?" },
    ...Object.entries(PATHS).map(([id, p]) => h("button.path", { type: "button", onclick: () => choose(id as Path, true) }, h("b", {}, `I have ${p.have}`), h("span", {}, p.how))),
  );
  const choose = (id: Path, focus = false, note = `STARTING FROM ${PATHS[id].have.toUpperCase()} `) => {
    const show: HTMLElement[] = PATHS[id].show;
    for (const b of blocks) b.hidden = !show.includes(b);
    work.hidden = false;
    const first = show[0]!;
    const fold = first.matches("details") ? first : first.querySelector("details");
    if (fold) (fold as HTMLDetailsElement).open = true;
    paths.hidden = true;
    pathNote.hidden = false;
    pathNote.replaceChildren(note, h("button.linkish", { type: "button", onclick: pickAgain }, "change"));
    if (focus) first.querySelector<HTMLElement>("summary, input, select, textarea")?.focus();
  };
  const pickAgain = () => {
    paths.hidden = false;
    pathNote.hidden = true;
    paths.querySelector("button")!.focus();
  };
  // Nothing below the paths shows until one is chosen.
  const work = h("div", { hidden: true }, ...blocks.slice(0, 7), sec.el, message, gridBox, out);

  root.append(paths, pathNote, work);
  decode();
  return { load, loadJson, useAlphabet: (a, choose = true) => (enc.setCustom(a, choose), decode()), note: (t) => (choose("file"), (message.textContent = t)) };
}
