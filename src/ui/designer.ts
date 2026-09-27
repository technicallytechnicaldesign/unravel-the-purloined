// Phase 7.4 alphabet designer: choose a size and the characters, draw each
// symbol, watch the check report, then send the alphabet to the encoder and
// decoder. The draft is kept in this browser only, as a convenience.

import { h, download } from "./h";
import { field, select } from "./controls";
import { cellGrid } from "./cellgrid";
import { loadDraft as load, saveDraft as save } from "./handover";
import { alphabetCode, parseAlphabetCode } from "../engine/alphabet";
import { checkAlphabet, emptyAlphabet, exportAlphabet, importAlphabet, legendSvg, MAX_SIZE, MIN_SIZE, suggestSymbols, toCells, toRows, type Alphabet } from "../engine/alphabet";
import { type Bit } from "../engine/fivebit";

const DEFAULT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ.?";

/** Crop or pad drawn rows to a new size, keeping the top-left corner. */
const resize = (rows: string[], w: number, ht: number): string[] => Array.from({ length: ht }, (_, r) => (rows[r] ?? "").slice(0, w).padEnd(w, "."));

export function mountDesigner(root: HTMLElement, use: (a: Alphabet) => void): void {
  let a: Alphabet = load() ?? emptyAlphabet("My alphabet", 4, 4);
  let chars = [...new Set([...Object.keys(a.symbols).filter((c) => c !== " "), ...(Object.keys(a.symbols).length > 1 ? [] : [...DEFAULT_CHARS])])];
  let current = chars[0] ?? "A";
  let seed = 1;

  const sizes = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => String(MIN_SIZE + i)).map((n) => [n, n] as [string, string]);
  const name = h("input", { type: "text", name: "alphabet-name", value: a.name, maxlength: 40 });
  const width = select("alphabet-width", sizes, String(a.width));
  const height = select("alphabet-height", sizes, String(a.height));
  const charInput = h("input", { type: "text", name: "alphabet-chars", value: chars.join(""), spellcheck: "false", autocomplete: "off" });
  const tiles = h("div.tiles", { role: "group", "aria-label": "Symbols. Choose one to draw it." });
  const editTitle = h("p.mono.field-label", {});
  const report = h("div.report", { role: "status" });
  const message = h("p.hint", { role: "status" });
  const file = h("input", { type: "file", accept: "application/json,.json", "aria-label": "Alphabet file" });
  const shareCode = h("p.mono.key-code.wrap", {});
  const codeIn = h("input", { type: "text", name: "alphabet-code", placeholder: "UTPA1-...", spellcheck: "false", autocomplete: "off", "aria-label": "Alphabet share code" });

  const editor = cellGrid({
    cells: toCells(resize([], a.width, a.height)),
    label: "Symbol drawing",
    colour: true,
    onChange: (cells: Bit[][]) => {
      const rows = toRows(cells);
      const symbols = { ...a.symbols };
      if (rows.some((r) => r.includes("x"))) symbols[current] = rows;
      else delete symbols[current]; // a blank drawing is an undrawn symbol
      a = { ...a, symbols };
      refresh(false);
    },
  });

  const mini = (rows: string[] | undefined) => {
    const g = h("span.mini", { "aria-hidden": "true" });
    g.style.setProperty("--cols", String(a.width));
    for (const row of rows ?? resize([], a.width, a.height)) for (const v of row) g.append(h(`i.${v === "x" ? "on" : "off"}`));
    return g;
  };

  /** Redraw tiles and report; reload the editor only when the symbol or size changed. */
  const refresh = (reloadEditor = true) => {
    a = { ...a, name: name.value.trim() || "My alphabet" };
    save(a);
    const check = checkAlphabet(a);
    const flagged = new Set(check.findings.filter((f) => f.severity !== "note").flatMap((f) => f.chars));
    tiles.replaceChildren(
      ...chars.map((ch) =>
        h(
          `button.tile${a.symbols[ch] ? "" : ".empty"}${flagged.has(ch) ? ".flagged" : ""}`,
          { type: "button", "aria-pressed": String(ch === current), "aria-label": `${ch}${a.symbols[ch] ? "" : ", not drawn"}${flagged.has(ch) ? ", has a finding" : ""}`, onclick: () => ((current = ch), refresh()) },
          mini(a.symbols[ch]),
          h("span.mono", {}, ch),
        ),
      ),
    );
    editTitle.textContent = `DRAWING "${current}"`;
    shareCode.textContent = alphabetCode(a);
    if (reloadEditor) editor.set(toCells(a.symbols[current] ?? resize([], a.width, a.height)));
    const undrawn = chars.filter((ch) => !a.symbols[ch]);
    report.replaceChildren(
      h("p", {}, check.slip),
      h("p.hint.mono", {}, `Closest pair: ${check.minDistance} stitch${check.minDistance === 1 ? "" : "es"} apart upright, ${check.turnDistance} turned or from the wrong side.`),
      undrawn.length ? h("p.hint", {}, `Not drawn yet, so left out of messages: ${undrawn.join(" ")}`) : "",
      check.findings.length
        ? h("ul.findings", {}, ...check.findings.map((f) => h(`li.${f.severity}`, {}, h("span.mono", {}, f.severity.toUpperCase()), " ", f.message)))
        : h("p.hint", {}, "No findings."),
    );
  };

  const setChars = () => {
    chars = [...new Set([...charInput.value.toUpperCase()].filter((ch) => !/\s/.test(ch)))];
    const symbols: Record<string, string[]> = { " ": a.symbols[" "]! };
    for (const ch of chars) if (a.symbols[ch]) symbols[ch] = a.symbols[ch]!;
    a = { ...a, symbols };
    if (!chars.includes(current)) current = chars[0] ?? "A";
    refresh();
  };
  const setSize = () => {
    const w = Number(width.value);
    const ht = Number(height.value);
    a = { ...a, width: w, height: ht, symbols: Object.fromEntries(Object.entries(a.symbols).map(([ch, rows]) => [ch, resize(rows, w, ht)])) };
    message.textContent = "Drawings kept their top-left corner; check the edges.";
    refresh();
  };
  const open = (text: string) => {
    const r = text.trim().startsWith("{") ? importAlphabet(text) : parseAlphabetCode(text);
    if (typeof r === "string") {
      message.textContent = r;
      return;
    }
    a = r;
    name.value = r.name;
    width.value = String(r.width);
    height.value = String(r.height);
    chars = Object.keys(r.symbols).filter((c) => c !== " ");
    charInput.value = chars.join("");
    current = chars[0] ?? "A";
    message.textContent = `Opened "${r.name}".`;
    refresh();
  };
  const printLegend = () => {
    const sheet = document.querySelector<HTMLElement>("#print-sheet")!;
    const check = checkAlphabet(a);
    sheet.replaceChildren(h("p.mono", {}, "UNRAVEL THE PURLOINED / ALPHABET LEGEND"), h("h1", {}, a.name), h("div.print-chart"), h("p", {}, check.slip), h("p.mono", {}, "An alphabet is not a cipher: anyone with this legend can read the message."));
    sheet.querySelector(".print-chart")!.innerHTML = legendSvg(a); // our own SVG, all text escaped
    window.print();
  };

  name.addEventListener("input", () => refresh(false));
  charInput.addEventListener("change", setChars);
  width.addEventListener("change", setSize);
  height.addEventListener("change", setSize);
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (f) open(await f.text());
  });

  const btn = (label: string, onclick: () => void) => h("button.btn", { type: "button", onclick }, label);
  root.append(
    h(
      "div.controls",
      {},
      h(
        "div.control-group",
        {},
        field("NAME", name),
        h("div.pair", {}, field("WIDTH", width), field("HEIGHT", height)),
        field("CHARACTERS", charInput, "Type every character you want a symbol for, then leave the field. Space is always the blank symbol."),
      ),
    ),
    tiles,
    h("div.designer", {}, h("div", {}, editTitle, h("div.scroll", {}, editor.el), h("p.hint", {}, "Filled is purl, or colour B. Click cells, or use the arrow keys and space."))),
    h(
      "div.actions",
      {},
      btn("Suggest the empty ones", () => {
        a = suggestSymbols(a, chars.filter((ch) => !a.symbols[ch]), seed++);
        message.textContent = "Filled every empty symbol with one as far from the others as could be found.";
        refresh();
      }),
      btn("Suggest this one again", () => {
        a = suggestSymbols(a, [current], seed++);
        refresh();
      }),
      btn("Clear this one", () => {
        const symbols = { ...a.symbols };
        delete symbols[current];
        a = { ...a, symbols };
        refresh();
      }),
    ),
    report,
    h(
      "div.actions",
      {},
      h(
        "button.btn.btn-go",
        {
          type: "button",
          onclick: () => {
            const check = checkAlphabet(a);
            if (!check.usable) message.textContent = "Fix the findings marked PROBLEM first.";
            else if (Object.keys(a.symbols).length < 2) message.textContent = "Draw at least one symbol first.";
            else (use(a), (message.textContent = `"${a.name}" is ready in the encoder as "Your alphabet". The decoder page offers it too.`));
          },
        },
        "Use in the encoder ↑",
      ),
      btn("Print the legend", printLegend),
      btn("Alphabet (JSON)", () => download(`${a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "alphabet"}.json`, "application/json", exportAlphabet(a))),
    ),
    h(
      "details.more",
      {},
      h("summary.mono", {}, "SHARE CODE"),
      h("p.hint", {}, "The whole alphabet as one line, to paste into a message. Anyone can open it here, or on the decoder page to read a piece knitted with it."),
      shareCode,
      h("div.actions", {}, btn("Copy the code", () => navigator.clipboard?.writeText(shareCode.textContent ?? "").then(() => (message.textContent = "Code copied."), () => (message.textContent = "Copy did not work here: select the code and copy it by hand.")))),
    ),
    h(
      "details.more",
      {},
      h("summary.mono", {}, "OPEN A CODE OR FILE"),
      codeIn,
      h("div.actions", {}, btn("Open this code", () => open(codeIn.value))),
      file,
    ),
    message,
  );
  refresh();
}
