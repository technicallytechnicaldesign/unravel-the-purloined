// T09 encode tool: settings in, every pipeline stage out, in order.

import { h, download, svgToPng } from "./h";
import { carrierControls, check, constructionControl, encodingControls, field } from "./controls";
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
  const width = h("input", { type: "number", name: "width", value: 12, min: 3, max: 60, inputmode: "numeric" });
  const border = check("border", "Border round the edge", true);
  const out = h("ol.steps");

  const render = () => {
    const w = Math.round(Number(width.value));
    if (!(w >= 3 && w <= 60)) {
      out.replaceChildren(h("li.step", {}, h("p.error", {}, "Width must be a whole number from 3 to 60.")));
      return;
    }
    const p = createProject({
      title: title.value || "Untitled",
      message: message.value,
      encoding: enc.get(),
      layout: { width: w, border: border.input.checked },
      carrier: car.get(),
      construction: con.get(),
    });
    const e = p.settings.encoding;
    const method = p.settings.construction.method;
    const dropped = [...new Set(p.message.dropped.map((d) => (/\s/.test(d.char) ? "space" : d.char)))];
    const svg = chartSvg({ title: p.settings.title, chart: p.output.chart, rows: p.output.rows, method, legend: p.output.legend });
    const stitches = p.output.chart[0]?.length ?? 0;
    const matches = p.output.decoded === p.message.normalized;

    out.replaceChildren(
      step(
        1,
        "Normalize",
        h("p.mono.big", {}, p.message.normalized || "(nothing left to carry)"),
        dropped.length ? h("p.error.mono", {}, `Left out, this alphabet cannot carry: ${dropped.join(" ")}`) : "",
        ...p.message.notes.map((n) => h("p.hint", {}, n)),
      ),
      step(
        2,
        e.alphabet === "fivebit" ? "Encode and add error checks" : e.alphabet === "morse" ? "Encode as Morse" : "Encode as A/B groups",
        h("p.hint", {}, `${p.output.bits.length} cells in the stream.`),
        symbolTable(p),
      ),
      step(
        3,
        "Logical grid",
        h("p.hint", {}, `${p.output.logicalGrid.length} rows of ${stitches} cells. Row 1 at the bottom. The message runs right to left from the bottom, between the marker row and the top row.`),
        h("div.scroll", {}, logicalGrid(p.output.logicalGrid, p.output.roles)),
        h("p.legend.mono", {}, h("span", {}, h("i.lcell.b1.role-data"), " message 1"), h("span", {}, h("i.lcell.b0.role-data"), " message 0"), h("span", {}, h("i.lcell.b1.role-marker"), " marker, top, border, padding")),
      ),
      step(4, "Chart", h("div.scroll.chart-svg", { role: "img", "aria-label": "Knitting chart" }), ...p.output.carrierNotes.map((n) => h("p.hint", {}, n))),
      step(
        5,
        method === "round" ? "Knit it: rounds" : "Knit it: rows",
        h("p.hint", {}, `Cast on ${stitches} stitches. Work each line as written; right-side and wrong-side are already handled.`),
        h("ol.instructions.mono", {}, ...[...p.output.instructions].map((line) => h("li", {}, line))),
        ...p.output.checks.map((c) => h("p.error.mono", {}, c)),
      ),
      step(
        6,
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
                  workbook({ title: p.settings.title, chart: p.output.chart, rows: p.output.rows, method, legend: p.output.legend, instructions: p.output.instructions, notes: [...p.message.notes, ...p.output.carrierNotes] }),
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
  const car = carrierControls(render, true);
  const con = constructionControl(render);
  for (const el of [message, title, width, border.input]) el.addEventListener("input", render);

  const form = h(
    "form.controls",
    { onsubmit: (ev: Event) => (ev.preventDefault(), render(), out.scrollIntoView({ behavior: "smooth" })) },
    field("MESSAGE", message),
    enc.el,
    h("div.control-group", {}, field("WIDTH (STITCHES)", width, "Border adds one each side."), border.el),
    car.el,
    con.el,
    field("PATTERN TITLE", title),
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
    h("p", {}, `Cast on ${stitches} stitches. ${method === "round" ? "Worked in the round" : "Worked flat"}. Row 1 is at the bottom of the chart, stitch 1 on the right.`),
    h("div.print-chart"),
    h("h2", {}, method === "round" ? "Rounds" : "Rows"),
    h("ol.instructions.mono", {}, ...p.output.instructions.map((l) => h("li", {}, l))),
    ...[...p.message.notes, ...p.output.carrierNotes, ...p.output.checks].map((n) => h("p", {}, n)),
    h("p.mono", {}, "Encoded is not encrypted. A modern reconstruction made at the lab."),
  );
  sheet.querySelector(".print-chart")!.innerHTML = svg;
  window.print();
}
