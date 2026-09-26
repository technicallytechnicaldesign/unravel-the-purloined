// The decoder's numbered steps, from cells to message, with a report whose
// lines highlight their cells. Shared by the lab and the game's decoder machine.

import { h } from "./h";
import { type DecodeSteps } from "../engine/steps";
import { type EncodingSettings } from "../engine/project";
import { type CellGrid } from "./cellgrid";

const title = (n: number, text: string) => h("h3.step-title", {}, h("span.step-n.mono", {}, String(n).padStart(2, "0")), ` ${text}`);

export function stepsView(s: DecodeSteps, e: EncodingSettings, grid: CellGrid): HTMLElement {
  const group = e.alphabet === "fivebit" ? 0 : 5;
  const morse = e.alphabet === "morse";
  grid.unmark("flag");
  grid.mark(s.findings.filter((f) => f.severity === "error").flatMap((f) => f.cells), "flag");
  return h(
    "ol.steps",
    {},
    h("li.step", {}, title(1, "Which way up"), h("p.mono", {}, `Read as: ${s.orientationText}.`)),
    h(
      "li.step",
      {},
      title(2, "Cells in reading order"),
      h("p.hint", {}, "Between the marker row and the top row, right to left from the bottom. End padding removed."),
      h("p.mono.bits", {}, group ? (s.bits.join("").match(/.{1,5}/g) ?? []).join(" ") : s.bits.join("") || "(none)"),
    ),
    h(
      "li.step",
      {},
      title(3, "Symbols"),
      s.symbols.length
        ? h(
            "div.scroll",
            {},
            h(
              "table.symbols.mono",
              {},
              h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", {}, morse ? "code" : "cells"), morse ? null : h("th", {}, "value"), h("th", {}, "reads"))),
              h("tbody", {}, ...s.symbols.map((y) => h(`tr${y.flagged ? ".flag" : ""}`, {}, h("td", {}, y.label), h("td", {}, y.cells), morse ? null : h("td", {}, y.value ?? ""), h("td", {}, y.out)))),
            ),
          )
        : h("p.hint", {}, "No whole symbols yet."),
    ),
    h("li.step", {}, title(4, "Message"), h(`p.mono.big${s.ok ? "" : ".error"}`, {}, s.text || "(nothing yet)")),
    h(
      "li.step",
      {},
      title(5, "Report"),
      s.findings.length
        ? h(
            "ul.findings",
            {},
            ...s.findings.map((f) =>
              h(
                `li.${f.severity}`,
                { onmouseenter: () => grid.mark(f.cells, "focus"), onmouseleave: () => grid.unmark("focus") },
                f.message,
              ),
            ),
          )
        : h("p.hint", {}, "Nothing to report."),
    ),
  );
}
