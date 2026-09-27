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
import { type Alphabet } from "../engine/alphabet";
import { type Bit } from "../engine/fivebit";
import { cellGrid } from "./cellgrid";
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

export function mountDecoder(root: HTMLElement): { load(p: Project): void; useAlphabet(a: Alphabet): void } {
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

  const decode = () => {
    cip.el.hidden = sec.on();
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
  const keyFile = h("input", { type: "file", accept: "application/json,.json", "aria-label": "Parcel key file" });
  keyFile.addEventListener("change", async () => {
    const f = keyFile.files?.[0];
    if (f) useKey(importKey(await f.text()));
  });

  const setCells = (next: Bit[][]) => {
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
    root.scrollIntoView({ behavior: "smooth" });
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

  root.append(
    h(
      "div.controls",
      {},
      h("div.control-group", {}, h("div.pair", {}, field("STITCHES PER ROW", width), field("ROWS", height)), field("BORDER DEPTH", border, "Stitches of border on each side; 0 for none. What the border holds does not matter.")),
      car.el,
      enc.el,
      cip.el,
      sec.el,
    ),
    h("div.actions", {}, h("button.btn", { type: "button", onclick: () => setCells(grid.get().map((r) => r.map(() => 0 as Bit))) }, "Clear")),
    h(
      "details.more",
      {},
      h("summary.mono", {}, "TYPE ROWS INSTEAD"),
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
    ),
    h(
      "details.more",
      {},
      h("summary.mono", {}, "OPEN A PARCEL KEY"),
      h("p.hint", {}, "For hidden messages. Type the code from a key card, or open a key file."),
      keyCode,
      h("div.actions", {}, h("button.btn", { type: "button", onclick: () => useKey(parseKeyCode(keyCode.value)) }, "Use this code"), h("button.btn", { type: "button", onclick: forgetKey }, "Put the key away")),
      keyFile,
    ),
    keyStatus,
    h(
      "details.more",
      {},
      h("summary.mono", {}, "OPEN A PROJECT FILE"),
      file,
      pasted,
      h("button.btn", { type: "button", onclick: () => loadJson(pasted.value) }, "Open pasted project"),
    ),
    message,
    h("div.scroll", {}, grid.el),
    out,
  );
  decode();
  return { load, useAlphabet: (a) => (enc.setCustom(a), decode()) };
}
