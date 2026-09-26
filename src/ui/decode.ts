// T10 manual grid decoder: click cells as knit/purl or colour A/B, see every
// step from cells to text, with errors pointed at the cells they are about.

import { h } from "./h";
import { carrierControls, cipherControls, encodingControls, field } from "./controls";
import { borderOf } from "../engine/grid";
import { decipher } from "../engine/ciphers";
import { decodeCells } from "../engine/steps";
import { importProject, type Project } from "../engine/project";
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

export function mountDecoder(root: HTMLElement): { load(p: Project): void } {
  const width = h("input", { type: "number", value: 8, min: 3, max: MAX, inputmode: "numeric" });
  const height = h("input", { type: "number", value: 8, min: 2, max: MAX, inputmode: "numeric" });
  const border = h("input", { type: "number", name: "border-depth", value: 0, min: 0, max: 8, inputmode: "numeric" });
  const depth = () => Math.max(0, Math.min(8, Math.round(Number(border.value)) || 0));
  const out = h("div");
  const message = h("p.hint", { role: "status" });

  const decode = () => {
    const s = decodeCells(grid.get(), depth(), enc.get());
    const cipher = cip.get();
    out.replaceChildren(
      stepsView(s, enc.get(), grid),
      cipher
        ? h(
            "ol.steps",
            {},
            h("li.step", {}, h("h3.step-title", {}, h("span.step-n.mono", {}, "06"), " Decipher"), h("p.mono.big", {}, decipher(s.text, cipher) || "(nothing yet)"), h("p.hint", {}, "The message above, run back through the cipher and key you chose.")),
          )
        : "",
    );
  };
  const grid = cellGrid({ cells: Array.from({ length: 8 }, () => new Array<Bit>(8).fill(0)), label: "Grid to decode", onChange: () => decode() });

  const resize = () => {
    const cells = grid.get();
    const w = Math.min(MAX, Math.max(3, Math.round(Number(width.value)) || 3));
    const ht = Math.min(MAX, Math.max(2, Math.round(Number(height.value)) || 2));
    grid.set(Array.from({ length: ht }, (_, r) => Array.from({ length: w }, (_, c) => cells[r]?.[c] ?? 0)));
  };

  const enc = encodingControls(decode);
  const cip = cipherControls(decode);
  const car = carrierControls(() => grid.setColour(car.get().id === "two-colour"), false);
  width.addEventListener("change", resize);
  height.addEventListener("change", resize);
  border.addEventListener("input", decode);

  const typed = h("textarea", { rows: 6, spellcheck: "false", placeholder: "Top row first. 0 or . = knit / A, 1 or x = purl / B\n1111111\n0110100\n1101000" });
  const pasted = h("textarea", { rows: 4, spellcheck: "false", placeholder: "Paste a downloaded project file here" });
  const file = h("input", { type: "file", accept: "application/json,.json" });

  const setCells = (next: Bit[][]) => {
    width.value = String(next[0]!.length);
    height.value = String(next.length);
    grid.set(next);
  };

  const load = (p: Project) => {
    enc.set(p.settings.encoding);
    cip.set(p.settings.cipher);
    car.set(p.settings.carrier.id);
    grid.setColour(p.settings.carrier.id === "two-colour");
    border.value = String(borderOf(p.settings.layout));
    setCells(p.output.logicalGrid.map((r) => [...r]));
    message.textContent = `Loaded "${p.settings.title}". Click cells to add mistakes and watch the report.`;
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
  return { load };
}
