// T10 manual grid decoder: click cells as knit/purl or colour A/B, see every
// step from cells to text, with errors pointed at the cells they are about.

import { h } from "./h";
import { carrierControls, check, encodingControls, field } from "./controls";
import { decodeCells, type DecodeSteps } from "../engine/steps";
import { importProject, type Project } from "../engine/project";
import { type Bit } from "../engine/fivebit";
import { type Cell } from "../engine/grid";

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
  let cells: Bit[][] = Array.from({ length: 8 }, () => new Array<Bit>(8).fill(0));
  const width = h("input", { type: "number", value: 8, min: 3, max: MAX, inputmode: "numeric" });
  const height = h("input", { type: "number", value: 8, min: 2, max: MAX, inputmode: "numeric" });
  const border = check("border", "Grid has a border", false);
  const grid = h("div.dgrid", { role: "group", "aria-label": "Grid to decode. Arrow keys move, space or enter switches a cell, Home and End jump along the row." });
  // One tab stop for the whole grid; arrow keys move between cells.
  let active: Cell = [7, 0];
  const cellButton = ([r, c]: Cell) => grid.querySelector<HTMLButtonElement>(`[data-cell="${r},${c}"]`);
  const moveTo = (next: Cell) => {
    cellButton(active)?.setAttribute("tabindex", "-1");
    active = next;
    const btn = cellButton(active);
    btn?.setAttribute("tabindex", "0");
    btn?.focus();
  };
  grid.addEventListener("keydown", (ev) => {
    const [r, c] = active;
    const w = cells[0]!.length;
    const next: Record<string, Cell> = {
      ArrowUp: [Math.min(r + 1, cells.length - 1), c],
      ArrowDown: [Math.max(r - 1, 0), c],
      ArrowLeft: [r, Math.max(c - 1, 0)],
      ArrowRight: [r, Math.min(c + 1, w - 1)],
      Home: [r, 0],
      End: [r, w - 1],
    };
    const to = next[ev.key];
    if (!to) return;
    ev.preventDefault();
    moveTo(to);
  });
  const out = h("ol.steps");
  const message = h("p.hint", { role: "status" });

  const resize = () => {
    const w = Math.min(MAX, Math.max(3, Math.round(Number(width.value)) || 3));
    const ht = Math.min(MAX, Math.max(2, Math.round(Number(height.value)) || 2));
    cells = Array.from({ length: ht }, (_, r) => Array.from({ length: w }, (_, c) => cells[r]?.[c] ?? 0));
    draw();
  };

  const draw = () => {
    const colour = car.get().id === "two-colour";
    const w = cells[0]!.length;
    grid.classList.toggle("colour", colour);
    grid.style.setProperty("--cols", String(w + 1));
    const hadFocus = grid.contains(document.activeElement);
    active = [Math.min(active[0], cells.length - 1), Math.min(active[1], w - 1)];
    grid.replaceChildren();
    for (let r = cells.length - 1; r >= 0; r--) {
      cells[r]!.forEach((b, c) => {
        const state = colour ? (b ? "colour B" : "colour A") : b ? "purl" : "knit";
        grid.append(
          h(`button.dcell.b${b}`, {
            type: "button",
            "data-cell": `${r},${c}`,
            "aria-label": `Row ${r + 1}, stitch ${w - c}: ${state}`,
            tabindex: r === active[0] && c === active[1] ? 0 : -1,
            onfocus: () => (active = [r, c]),
            onclick: () => {
              cells[r]![c] = (1 - cells[r]![c]!) as Bit;
              draw();
            },
          }),
        );
      });
      grid.append(h("span.rownum.mono", { "aria-hidden": "true" }, r + 1));
    }
    if (hadFocus) cellButton(active)?.focus();
    decode();
  };

  const mark = (list: Cell[], cls: string) => {
    for (const [r, c] of list) grid.querySelector(`[data-cell="${r},${c}"]`)?.classList.add(cls);
  };

  const decode = () => {
    const s: DecodeSteps = decodeCells(cells, border.input.checked, enc.get());
    const e = enc.get();
    const group = e.alphabet === "fivebit" ? 0 : 5;
    mark(s.findings.filter((f) => f.severity === "error").flatMap((f) => f.cells), "flag");
    out.replaceChildren(
      h("li.step", {}, h("h3.step-title", {}, h("span.step-n.mono", {}, "01"), " Which way up"), h("p.mono", {}, `Read as: ${s.orientationText}.`)),
      h(
        "li.step",
        {},
        h("h3.step-title", {}, h("span.step-n.mono", {}, "02"), " Cells in reading order"),
        h("p.hint", {}, "Between the marker row and the top row, right to left from the bottom. End padding removed."),
        h("p.mono.bits", {}, group ? (s.bits.join("").match(/.{1,5}/g) ?? []).join(" ") : s.bits.join("") || "(none)"),
      ),
      h(
        "li.step",
        {},
        h("h3.step-title", {}, h("span.step-n.mono", {}, "03"), " Symbols"),
        s.symbols.length
          ? h(
              "div.scroll",
              {},
              h(
                "table.symbols.mono",
                {},
                h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", {}, e.alphabet === "morse" ? "code" : "cells"), e.alphabet !== "morse" ? h("th", {}, "value") : null, h("th", {}, "reads"))),
                h("tbody", {}, ...s.symbols.map((y) => h(`tr${y.flagged ? ".flag" : ""}`, {}, h("td", {}, y.label), h("td", {}, y.cells), e.alphabet !== "morse" ? h("td", {}, y.value ?? "") : null, h("td", {}, y.out)))),
              ),
            )
          : h("p.hint", {}, "No whole symbols yet."),
      ),
      h("li.step", {}, h("h3.step-title", {}, h("span.step-n.mono", {}, "04"), " Message"), h(`p.mono.big${s.ok ? "" : ".error"}`, {}, s.text || "(nothing yet)")),
      h(
        "li.step",
        {},
        h("h3.step-title", {}, h("span.step-n.mono", {}, "05"), " Report"),
        s.findings.length
          ? h(
              "ul.findings",
              {},
              ...s.findings.map((f) =>
                h(
                  `li.${f.severity}`,
                  {
                    onmouseenter: () => mark(f.cells, "focus"),
                    onmouseleave: () => grid.querySelectorAll(".focus").forEach((el) => el.classList.remove("focus")),
                  },
                  f.message,
                  f.cells.length ? h("span.hint", {}, ` (${f.cells.length} cell${f.cells.length === 1 ? "" : "s"} marked in red)`) : "",
                ),
              ),
            )
          : h("p.hint", {}, "Nothing to report."),
      ),
    );
  };

  const enc = encodingControls(decode);
  const car = carrierControls(draw, false);
  width.addEventListener("change", resize);
  height.addEventListener("change", resize);
  border.input.addEventListener("change", decode);

  const typed = h("textarea", { rows: 6, spellcheck: "false", placeholder: "Top row first. 0 or . = knit / A, 1 or x = purl / B\n1111111\n0110100\n1101000" });
  const pasted = h("textarea", { rows: 4, spellcheck: "false", placeholder: "Paste a downloaded project file here" });
  const file = h("input", { type: "file", accept: "application/json,.json" });

  const setCells = (next: Bit[][]) => {
    cells = next;
    width.value = String(next[0]!.length);
    height.value = String(next.length);
    draw();
  };

  const load = (p: Project) => {
    enc.set(p.settings.encoding);
    car.set(p.settings.carrier.id);
    border.input.checked = p.settings.layout.border;
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
      h("div.control-group", {}, h("div.pair", {}, field("STITCHES PER ROW", width), field("ROWS", height)), border.el),
      car.el,
      enc.el,
    ),
    h(
      "div.actions",
      {},
      h("button.btn", { type: "button", onclick: () => setCells(cells.map((r) => r.map(() => 0 as Bit))) }, "Clear"),
    ),
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
    h("div.scroll", {}, grid),
    out,
  );
  draw();
  return { load };
}
