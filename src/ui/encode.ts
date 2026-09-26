// T09 encode tool: settings in, every pipeline stage out, in order.

import { h, download, svgToPng } from "./h";
import { carrierControls, cipherControls, constructionControl, encodingControls, field, select } from "./controls";
import { fromRecipe, RECIPES, type RecipeId } from "../engine/recipes";
import { PATTERNS, patternsFor, type StitchPattern } from "../engine/stitches";
import { createProject, exportProject, type Project } from "../engine/project";
import { chartSvg } from "../engine/chartsvg";
import { chartCsv, workbook } from "../engine/xlsx";
import { describeStream } from "../engine/steps";
import { type CellRole } from "../engine/grid";
import { type Bit } from "../engine/fivebit";

const ROLE_TEXT: Record<CellRole, string> = {
  data: "message",
  pad: "end padding (a 1, then 0s)",
  marker: "orientation marker",
  top: "top row",
  border: "border",
};

function step(n: number, title: string, ...body: (Node | string)[]): HTMLElement {
  return h("li.step", {}, h("h3.step-title", {}, h("span.step-n.mono", {}, String(n).padStart(2, "0")), " ", title), ...body);
}

function logicalGrid(cells: Bit[][], roles: CellRole[][]): HTMLElement {
  const grid = h("div.lgrid", { role: "img", "aria-label": `Logical grid, ${cells.length} rows of ${cells[0]?.length ?? 0} cells` });
  grid.style.setProperty("--cols", String(cells[0]?.length ?? 0));
  for (let r = cells.length - 1; r >= 0; r--) {
    cells[r]!.forEach((b, c) => grid.append(h(`i.lcell.b${b}.role-${roles[r]![c]}`, { title: `row ${r + 1}, ${ROLE_TEXT[roles[r]![c]!]}: ${b}` })));
  }
  return grid;
}

function symbolTable(p: Project): HTMLElement {
  const rows = describeStream(p.output.bits, p.settings.encoding);
  const e = p.settings.encoding;
  const valueCol = e.alphabet !== "morse";
  return h(
    "div.scroll",
    {},
    h(
      "table.symbols.mono",
      {},
      h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", {}, e.alphabet === "morse" ? "code" : "cells"), valueCol ? h("th", {}, "value") : null, h("th", {}, "reads"))),
      h("tbody", {}, ...rows.map((s) => h(`tr${s.flagged ? ".flag" : ""}`, {}, h("td", {}, s.label), h("td", {}, s.cells), valueCol ? h("td", {}, s.value ?? "") : null, h("td", {}, s.out)))),
    ),
  );
}

export function mountEncoder(root: HTMLElement, sendToDecoder: (p: Project) => void): void {
  const message = h("input", { type: "text", name: "message", value: "Meet at noon.", maxlength: 120, autocomplete: "off", spellcheck: "false" });
  const title = h("input", { type: "text", name: "title", value: "Meet at noon", maxlength: 60 });
  const width = h("input", { type: "number", name: "width", value: 12, min: 3, max: 120, inputmode: "numeric" });
  const recipe = select("recipe", [["none", "My own settings"], ...Object.values(RECIPES).map((r) => [r.id, r.name] as [string, string])]);
  const recipeNote = h("p.hint", {});
  const borderDepth = h("input", { type: "number", name: "border-depth", value: 1, min: 0, max: 8, inputmode: "numeric" });
  const borderStyle = select("border-style", []);
  const edgeBelow = h("input", { type: "number", name: "edge-below", value: 0, min: 0, max: 60, step: 2, inputmode: "numeric" });
  const edgeAbove = h("input", { type: "number", name: "edge-above", value: 0, min: 0, max: 60, step: 2, inputmode: "numeric" });
  const edgePattern = select("edge-pattern", []);
  const out = h("ol.steps");

  // Border and edge patterns depend on the carrier: knit/purl textures or two colours.
  const fillPatterns = () => {
    const carrier = car.get().id;
    for (const [sel, plain] of [[borderStyle, "Plain (same as the background)"], [edgePattern, "Same as the border"]] as const) {
      const keep = sel.value;
      sel.replaceChildren(h("option", { value: "plain" }, plain), ...patternsFor(carrier).map((k) => h("option", { value: k }, PATTERNS[k].name)));
      sel.value = [...sel.options].some((o) => o.value === keep) ? keep : "plain";
    }
  };

  const applyRecipe = () => {
    const id = recipe.value as RecipeId | "none";
    if (id === "none") {
      recipeNote.textContent = "Every setting is yours to choose.";
      return;
    }
    const r = fromRecipe(id, car.get().id);
    width.value = String(r.layout.width);
    con.set(r.construction);
    borderDepth.value = String(r.layout.borderWidth);
    fillPatterns();
    borderStyle.value = r.borderStyle;
    edgeBelow.value = String(r.edges.below);
    edgeAbove.value = String(r.edges.above);
    edgePattern.value = r.edges.pattern;
    recipeNote.textContent = `${RECIPES[id].summary} Change anything below; the recipe only sets starting values.`;
  };

  const render = () => {
    const w = Math.round(Number(width.value));
    if (!(w >= 3 && w <= 120)) {
      out.replaceChildren(h("li.step", {}, h("p.error", {}, "Width must be a whole number from 3 to 120.")));
      return;
    }
    const cipher = cip.get();
    const depth = Math.max(0, Math.min(8, Math.round(Number(borderDepth.value)) || 0));
    const style = borderStyle.value as StitchPattern | "plain";
    const edgeStyle = (edgePattern.value === "plain" ? style : edgePattern.value) as StitchPattern | "plain";
    const below = Math.max(0, Math.round(Number(edgeBelow.value)) || 0);
    const above = Math.max(0, Math.round(Number(edgeAbove.value)) || 0);
    let p: Project;
    try {
      p = createProject({
        title: title.value || "Untitled",
        message: message.value,
        encoding: enc.get(),
        layout: { width: w, border: depth > 0, borderWidth: depth },
        ...(style !== "plain" ? { borderStyle: style } : {}),
        ...(edgeStyle !== "plain" && below + above > 0 ? { edges: { below, above, pattern: edgeStyle } } : {}),
        ...(recipe.value !== "none" ? { recipe: recipe.value as RecipeId } : {}),
        carrier: car.get(),
        construction: con.get(),
        ...(cipher ? { cipher } : {}),
      });
    } catch (err) {
      out.replaceChildren(h("li.step", {}, h("p.error", {}, err instanceof Error ? err.message : String(err))));
      return;
    }
    let n = 0;
    const next = () => ++n;
    const e = p.settings.encoding;
    const method = p.settings.construction.method;
    const dropped = [...new Set(p.message.dropped.map((d) => (/\s/.test(d.char) ? "space" : d.char)))];
    const svg = chartSvg({ title: p.settings.title, chart: p.output.chart, rows: p.output.rows, method, legend: p.output.legend });
    const stitches = p.output.chart[0]?.length ?? 0;
    const matches = p.output.decoded === p.message.normalized;

    out.replaceChildren(
      step(
        next(),
        "Normalize",
        h("p.mono.big", {}, p.message.normalized || "(nothing left to carry)"),
        dropped.length ? h("p.error.mono", {}, `Left out, this alphabet cannot carry: ${dropped.join(" ")}`) : "",
        ...p.message.notes.map((n) => h("p.hint", {}, n)),
      ),
      p.message.enciphered !== undefined
        ? step(next(), "Encipher", h("p.mono.big", {}, p.message.enciphered), h("p.hint", {}, "This is what gets knitted. The decoder needs the same cipher and key to read it back."))
        : "",
      step(
        next(),
        e.alphabet === "fivebit" ? "Encode and add error checks" : e.alphabet === "morse" ? "Encode as Morse" : "Encode as A/B groups",
        h("p.hint", {}, `${p.output.bits.length} cells in the stream.`),
        symbolTable(p),
      ),
      step(
        next(),
        "Logical grid",
        h("p.hint", {}, `${p.output.logicalGrid.length} rows of ${stitches} cells. Row 1 at the bottom. The message runs right to left from the bottom, between the marker row and the top row.`),
        h("div.scroll", {}, logicalGrid(p.output.logicalGrid, p.output.roles)),
        h("p.legend.mono", {}, h("span", {}, h("i.lcell.b1.role-data"), " message 1"), h("span", {}, h("i.lcell.b0.role-data"), " message 0"), h("span", {}, h("i.lcell.b1.role-marker"), " marker, top, border, padding")),
      ),
      step(next(), "Chart", h("div.scroll.chart-svg", { role: "img", "aria-label": "Knitting chart" }), ...p.output.carrierNotes.map((n) => h("p.hint", {}, n))),
      step(
        next(),
        method === "round" ? "Knit it: rounds" : "Knit it: rows",
        h("p.hint", {}, "Work each line as written; right side and wrong side are already handled."),
        ...p.output.preamble.map((line) => h("p.mono.section-line", {}, line)),
        h("ol.instructions.mono", {}, ...[...p.output.instructions].map((line) => h("li", {}, line))),
        ...p.output.finishing.map((line) => h("p.mono.section-line", {}, line)),
        h("p.hint", {}, p.output.dimensions),
        ...p.output.checks.map((c) => h("p.error.mono", {}, c)),
      ),
      step(
        next(),
        "Check",
        h(`p.mono.big${matches ? "" : ".error"}`, {}, `Read back from the pattern: ${p.output.decoded || "(empty)"}`),
        h("p.hint", {}, matches ? "The pattern decodes to the message." : "The pattern does not decode to the message. Please report this."),
        h(
          "div.actions",
          {},
          h("button.btn", { type: "button", onclick: () => printPattern(p, svg) }, "Print or save as PDF"),
          h("button.btn", { type: "button", onclick: () => svgToPng(svg).then((png) => download(`${slug(p)}-chart.png`, "image/png", png)) }, "Chart (PNG)"),
          h("button.btn", { type: "button", onclick: () => download(`${slug(p)}-chart.svg`, "image/svg+xml", svg) }, "Chart (SVG)"),
          h(
            "button.btn",
            {
              type: "button",
              onclick: () =>
                download(
                  `${slug(p)}.xlsx`,
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  workbook({ title: p.settings.title, chart: p.output.chart, rows: p.output.rows, method, legend: p.output.legend, instructions: [...p.output.preamble, ...p.output.instructions, ...p.output.finishing], notes: [...p.message.notes, ...p.output.carrierNotes, p.output.dimensions] }),
                ),
            },
            "Spreadsheet (XLSX)",
          ),
          h("button.btn", { type: "button", onclick: () => download(`${slug(p)}-chart.csv`, "text/csv", chartCsv(p.output.chart)) }, "Chart (CSV)"),
          h("button.btn", { type: "button", onclick: () => download(`${slug(p)}.json`, "application/json", exportProject(p)) }, "Project (JSON)"),
        ),
        h("div.actions", {}, h("button.btn", { type: "button", onclick: () => sendToDecoder(p) }, "Try it in the decoder ↓")),
      ),
    );
    // The SVG is our own output, built from escaped text only.
    out.querySelector(".chart-svg")!.innerHTML = svg;
  };

  const enc = encodingControls(render);
  const car = carrierControls(() => (fillPatterns(), recipe.value !== "none" && applyRecipe(), render()), true);
  const con = constructionControl(render);
  const cip = cipherControls(render);
  fillPatterns();
  applyRecipe();
  for (const el of [message, title, width, borderDepth, edgeBelow, edgeAbove]) el.addEventListener("input", render);
  for (const el of [borderStyle, edgePattern]) el.addEventListener("change", render);
  recipe.addEventListener("change", () => (applyRecipe(), render()));

  const stage = (n: number, name: string, ...body: HTMLElement[]) => h("fieldset.stage", {}, h("legend.mono", {}, h("span.step-n", {}, String(n).padStart(2, "0")), ` ${name}`), ...body);
  const form = h(
    "form.builder",
    { onsubmit: (ev: Event) => (ev.preventDefault(), render(), out.scrollIntoView({ behavior: "smooth" })) },
    stage(1, "MESSAGE", field("MESSAGE", message), field("PATTERN TITLE", title)),
    stage(2, "ENCODE", enc.el, cip.el),
    stage(3, "RECIPE", field("START FROM", recipe), recipeNote),
    stage(4, "CARRIER", car.el),
    stage(5, "SIZE AND CONSTRUCTION", field("MESSAGE WIDTH (STITCHES)", width, "The border adds its depth on each side."), con.el),
    stage(
      6,
      "BORDER AND EDGES",
      h("div.pair", {}, field("BORDER DEPTH", borderDepth, "0 for none."), field("BORDER PATTERN", borderStyle)),
      h("div.pair", {}, field("PLAIN ROWS BELOW", edgeBelow), field("PLAIN ROWS ABOVE", edgeAbove)),
      field("EDGE PATTERN", edgePattern, "Edge rows are rounded up to even numbers so row 1 of the chart stays on the right side."),
    ),
    stage(7, "FILLER", h("p.hint", {}, "Coming next. How a filler pattern stays apart from the message is a design choice still to make (roadmap T16).")),
    h("button.btn.btn-go", { type: "submit" }, "Generate signal →"),
  );
  root.append(form, out);
  render();
}

const slug = (p: Project) => (p.settings.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pattern");

/** Fill the print sheet with the pattern and open the browser's print dialog, where "Save as PDF" lives. */
function printPattern(p: Project, svg: string): void {
  const sheet = document.querySelector<HTMLElement>("#print-sheet")!;
  const stitches = p.output.chart[0]?.length ?? 0;
  const method = p.settings.construction.method;
  sheet.replaceChildren(
    h("p.mono", {}, "UNRAVEL THE PURLOINED / PATTERN"),
    h("h1", {}, p.settings.title),
    h("p", {}, `${stitches} stitches, ${method === "round" ? "worked in the round" : "worked flat"}. Row 1 is at the bottom of the chart, stitch 1 on the right. ${p.output.dimensions}`),
    h("div.print-chart"),
    h("h2", {}, method === "round" ? "Rounds" : "Rows"),
    ...p.output.preamble.map((l) => h("p.mono", {}, l)),
    h("ol.instructions.mono", {}, ...p.output.instructions.map((l) => h("li", {}, l))),
    ...p.output.finishing.map((l) => h("p.mono", {}, l)),
    ...[...p.message.notes, ...p.output.carrierNotes, ...p.output.checks].map((n) => h("p", {}, n)),
    h("p.mono", {}, "Encoded is not encrypted. A modern reconstruction made at the lab."),
  );
  sheet.querySelector(".print-chart")!.innerHTML = svg;
  window.print();
}
