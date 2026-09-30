// Case 00, the training parcel: one fixed, tiny parcel read together, step by
// step. Each step rings what to look at on the drawing and on the copy, and
// copying steps check every square and say which one is off. Nothing is timed.

import { h } from "./h";
import { cellGrid } from "./cellgrid";
import { createProject, type ProjectSettings } from "../engine/project";
import { fabricLayout, fabricSvg } from "../engine/fabric";
import { dataCellOrder, type Cell } from "../engine/grid";
import { type Bit } from "../engine/fivebit";

const SETTINGS: ProjectSettings = {
  title: "Training parcel",
  message: "HI",
  layout: { width: 10, border: false },
  construction: { method: "flat", firstRow: "RS" },
  encoding: { alphabet: "fivebit", errorControl: { code: "plain", separator: false, checksum: false } },
  carrier: { id: "purl-relief" },
};
export const TRAINING_ANSWER = "HI";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WEIGHTS = [16, 8, 4, 2, 1];

interface Step {
  title: string;
  body: (Node | string)[];
  /** Stitches to ring on the drawing, [row, col] with row 0 at the bottom. */
  fabric?: Cell[];
  /** Squares to ring on the copy. */
  copy?: Cell[];
  /** Copy rows that must match the parcel before Next opens. */
  task?: number[];
  /** The last step: type the answer. */
  answer?: boolean;
}

const rowCells = (r: number, w: number): Cell[] => Array.from({ length: w }, (_, c) => [r, c] as Cell);

/** The four groups of five the training reads (START, two letters, END), in reading order. Pure, for tests. */
export function trainingGroups(bits: Bit[][]): { cells: Cell[]; value: number; reads: string }[] {
  const order = dataCellOrder(bits.length, bits[0]!.length, 0);
  return [0, 1, 2, 3].map((k) => {
    const cells = order.slice(k * 5, k * 5 + 5);
    const value = cells.reduce((v, [r, c]) => v * 2 + bits[r]![c]!, 0);
    return { cells, value, reads: value === 28 ? "START" : value === 29 ? "END" : (LETTERS[value] ?? "?") };
  });
}

/** The training steps, built from the parcel itself so the words always match the stitches. */
function trainingSteps(bits: Bit[][]): Step[] {
  const height = bits.length;
  const w = bits[0]!.length;
  const order = dataCellOrder(height, w, 0);
  const value = (cells: Cell[]) => cells.reduce((v, [r, c]) => v * 2 + bits[r]![c]!, 0);
  const strip = (cells: Cell[], reads: string) => {
    const b = cells.map(([r, c]) => bits[r]![c]!);
    const sum = WEIGHTS.filter((_, i) => b[i]).join(" + ") || "0";
    return h(
      "div.tut-read",
      {},
      h("div.tut-bits.mono", {}, ...b.map((x, i) => h(`span.tut-bit${x ? ".on" : ""}`, {}, h("b", {}, String(x)), h("small", {}, String(WEIGHTS[i]))))),
      h("p.mono", {}, `${b.filter(Boolean).length > 1 ? `${sum} = ` : ""}${value(cells)}  →  ${reads}`),
    );
  };
  const letter = (cells: Cell[]) => LETTERS[value(cells)] ?? "?";
  const [start, first, second, end] = trainingGroups(bits).map((g) => g.cells) as [Cell[], Cell[], Cell[], Cell[]];
  const pad = order.slice(20).filter(([r]) => r < height - 1);
  const ring = (r: number) => rowCells(r, w);
  const firstRowOf = (cells: Cell[]) => cells[0]![0] + 1;

  return [
    {
      title: "A training parcel",
      body: [
        h("p", {}, "This small piece of knitting holds a short message. We will read it together, one step at a time."),
        h("p", {}, "Every parcel in the folio works the same way, so once you have read this one the case files will feel familiar."),
        h("p.hint", {}, "Red rings show where to look: on the drawing (Exhibit A) and on your copy."),
      ],
      fabric: Array.from({ length: height }, (_, r) => ring(r)).flat(),
    },
    {
      title: "Knit and purl",
      body: [
        h("p", {}, "Two kinds of stitch make every message. The ringed stitch on the far left is a ", h("b", {}, "purl"), ": a little bump lying across. It counts as 1."),
        h("p", {}, "Two along, the ringed ", h("b", {}, "knit"), " stitch looks like a V. It counts as 0."),
        h("p.hint", {}, "On your copy, an empty square is knit and a square with a dot is purl."),
      ],
      fabric: [[0, 0], [0, 2]],
    },
    {
      title: "Clue 1: the marker row",
      body: [
        h("p", {}, "Look along the bottom edge. From the left it reads purl, purl, knit, purl, then knit to the end: 1 1 0 1 0 0 ..."),
        h("p", {}, "That is the ", h("b", {}, "marker row"), ". Whenever you find it, that edge is the bottom and you are looking at the parcel the right way round."),
        h("p", {}, h("b", {}, "Your turn: "), "copy it into row 1 of your copy (the bottom row). Tap squares 1, 2 and 4 from the left to give them a dot."),
      ],
      fabric: ring(0),
      copy: ring(0),
      task: [0],
    },
    {
      title: "Clue 2: the top row",
      body: [
        h("p", {}, "Now the top edge: every stitch is purl. A row of all purl is the ", h("b", {}, "top row"), ". The message sits between the marker and the top."),
        h("p", {}, h("b", {}, "Your turn: "), `copy it: give every square in row ${height} a dot.`),
      ],
      fabric: ring(height - 1),
      copy: ring(height - 1),
      task: [height - 1],
    },
    ...Array.from({ length: height - 2 }, (_, i): Step => ({
      title: `Copy row ${i + 2}`,
      body: [
        h("p", {}, i === 0 ? "Now the message itself. Copy the ringed row, stitch by stitch, from the left: a V stays empty, a bump gets a dot." : "Same again for the next row up."),
        h("p.hint", {}, "Copy what you see. You do not need to understand it yet."),
      ],
      fabric: ring(i + 1),
      copy: ring(i + 1),
      task: [i + 1],
    })),
    {
      title: "Read right to left, in fives",
      body: [
        h("p", {}, `Start in row ${firstRowOf(start)}, just above the marker, at the right-hand end. Read five squares going left. Each place is worth a number: 16, 8, 4, 2, 1. Add up the places with a dot.`),
        strip(start, "START"),
        h("p", {}, h("b", {}, "Clue 3: "), "28 is not a letter. It is ", h("b", {}, "START"), ", the sign that the message begins here."),
      ],
      copy: start,
    },
    {
      title: "Your first letter",
      body: [
        h("p", {}, "Carry on left for the next five."),
        strip(first, letter(first)),
        h("p", {}, `Letters count from A = 0: A 0, B 1, C 2 ... so ${value(first)} is ${letter(first)}.`),
        h("p.hint", {}, "The full key: A=0 ... Z=25, space=26, full stop=27, START=28, END=29."),
      ],
      copy: first,
    },
    {
      title: "Next row up, again from the right",
      body: [
        h("p", {}, `When a row runs out, go up to row ${firstRowOf(second)} and start again at its right-hand end.`),
        strip(second, letter(second)),
      ],
      copy: second,
    },
    {
      title: "Clue 4: END",
      body: [
        strip(end, "END"),
        h("p", {}, "29 is ", h("b", {}, "END"), ": the message is over. Whatever comes after it (a 1, then 0s) only fills out the row. You can ignore it."),
      ],
      copy: [...end, ...pad],
    },
    {
      title: "Type what you found",
      body: [h("p", {}, "Put the letters between START and END together.")],
      answer: true,
    },
  ];
}

export function trainingSheet(opts: { back: () => void; solved: () => void; next: () => void }): HTMLElement {
  const project = createProject(SETTINGS, "training");
  const chart = project.output.chart;
  const bits = chart.map((r) => r.map((v) => (v === "purl" ? 1 : 0) as Bit));
  const height = bits.length;
  const w = bits[0]!.length;
  const steps = trainingSteps(bits);
  const look = { seed: 7, stitch: 26, wobble: 0.3 };

  const figure = h("div.scroll.evidence-img");
  figure.innerHTML = fabricSvg(chart, { ...look, label: `Evidence photograph: knitted fabric, ${height} rows of ${w} stitches.` }); // our own SVG
  const svg = figure.querySelector("svg")!;
  const where = fabricLayout(chart, look);
  const rings = document.createElementNS("http://www.w3.org/2000/svg", "g");
  rings.setAttribute("class", "tut-rings");
  svg.append(rings);

  const grid = cellGrid({ cells: Array.from({ length: height }, () => new Array<Bit>(w).fill(0)), label: "Your copy of the training parcel", onChange: () => refresh() });
  let at = 0;

  const coach = h("section.coach", { "aria-live": "polite" });
  const feedback = h("p.tut-feedback", { role: "status" });

  /** Ring cells on the drawing, one rectangle per run along a row. */
  const drawRings = (cells: Cell[] = []) => {
    rings.replaceChildren();
    const byRow = new Map<number, number[]>();
    for (const [r, c] of cells) byRow.set(r, [...(byRow.get(r) ?? []), c]);
    for (const [r, cols] of byRow) {
      cols.sort((a, b) => a - b);
      for (let i = 0; i < cols.length; ) {
        let j = i;
        while (j + 1 < cols.length && cols[j + 1] === cols[j]! + 1) j++;
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const band = where.rows[r]!;
        rect.setAttribute("x", String(where.pad + cols[i]! * where.stitch - 2));
        rect.setAttribute("y", String(band.y - 2));
        rect.setAttribute("width", String((j - i + 1) * where.stitch + 4));
        rect.setAttribute("height", String(band.h + 4));
        rect.setAttribute("class", "tut-ring");
        rings.append(rect);
        i = j + 1;
      }
    }
  };

  /** The first square in the task rows that differs from the parcel, or undefined when they all match. */
  const firstWrong = (rows: number[]): Cell | undefined => {
    const copy = grid.get();
    for (const r of rows) for (let c = 0; c < w; c++) if (copy[r]![c] !== bits[r]![c]) return [r, c];
    return undefined;
  };

  const nextBtn = h("button.btn.btn-go", { type: "button", onclick: () => go(at + 1) }, "Next →");
  const refresh = () => {
    const s = steps[at]!;
    grid.unmark("tut");
    grid.unmark("focus");
    grid.mark(s.copy ?? [], "tut");
    if (!s.task) return;
    const wrong = firstWrong(s.task);
    nextBtn.toggleAttribute("disabled", !!wrong);
    if (!wrong) {
      feedback.className = "tut-feedback ok";
      feedback.textContent = `Row ${s.task[0]! + 1} matches the parcel. On to the next step.`;
      return;
    }
    const [r, c] = wrong;
    grid.mark([wrong], "focus");
    feedback.className = "tut-feedback";
    feedback.textContent = `Row ${r + 1}, square ${c + 1} from the left: ${bits[r]![c] ? "should have a dot (purl)" : "should be empty (knit)"}.`;
  };

  /** Fill the task rows for the player, for anyone who is stuck. */
  const showMe = () => {
    const s = steps[at]!;
    const copy = grid.get().map((r) => [...r]);
    for (const r of s.task ?? []) copy[r] = [...bits[r]!];
    grid.set(copy);
  };

  const go = (n: number) => {
    at = Math.max(0, Math.min(steps.length - 1, n));
    const s = steps[at]!;
    drawRings(s.fabric);
    feedback.textContent = "";
    feedback.className = "tut-feedback";
    nextBtn.removeAttribute("disabled");
    const back = h("button.btn", { type: "button", onclick: () => go(at - 1) }, "← Back");
    back.toggleAttribute("disabled", at === 0);
    let answerForm: HTMLElement | "" = "";
    if (s.answer) {
      const input = h("input", { type: "text", name: "training-answer", autocomplete: "off", spellcheck: "false", "aria-label": "The message reads" });
      answerForm = h(
        "form.answer",
        {
          onsubmit: (ev: Event) => {
            ev.preventDefault();
            if (input.value.toUpperCase().replace(/[^A-Z]/g, "") === TRAINING_ANSWER) {
              opts.solved();
              coach.replaceChildren(...done());
            } else {
              feedback.textContent = "Not quite. Look back at the two letters between START and END; Back takes you there.";
            }
          },
        },
        h("label.field", {}, h("span.mono.field-label", {}, "THE MESSAGE READS"), input),
        h("button.btn.btn-go", { type: "submit" }, "Check →"),
      );
    }
    coach.replaceChildren(
      h("p.mono.coach-count", {}, `STEP ${at + 1} OF ${steps.length}`),
      h("h3.coach-title", {}, s.title),
      ...s.body,
      answerForm,
      feedback,
      h("div.actions", {}, back, s.task ? h("button.btn", { type: "button", onclick: showMe }, "Show me") : "", s.answer ? "" : nextBtn),
    );
    refresh();
  };

  const done = () => [
    h("p.mono.coach-count", {}, "TRAINING COMPLETE"),
    h("h3.coach-title", {}, h("span.stamp", {}, "SOLVED"), " The parcel says HI."),
    h("p", {}, "Clues to look for in every parcel:"),
    h(
      "ol.primer-list",
      {},
      h("li", {}, "The marker row, 1 1 0 1 then 0s. It shows which edge is the bottom and which way round the piece is."),
      h("li", {}, "The top row, all purl (or all 1). The message sits between."),
      h("li", {}, "START and END. The message begins after one and stops at the other."),
      h("li", {}, "The briefing. It says how letters are made: groups of five, Morse, two colours, or something stranger."),
      h("li", {}, "Notes and key cards. Anything tucked into a parcel may be the key."),
    ),
    h("p.hint", {}, "If a parcel looks upside down or back to front, find the marker first: the decoder machine can turn it for you."),
    h("div.actions", {}, h("button.btn.btn-go", { type: "button", onclick: opts.next }, "Open case file 01 →"), h("button.btn", { type: "button", onclick: () => go(0) }, "Start the training again")),
  ];

  const sheet = h(
    "article.sheet",
    {},
    h("header.sheet-head", {}, h("button.btn.btn-small", { type: "button", onclick: opts.back }, "← Folio"), h("p.mono", {}, "CASE FILE 00 / TRAINING"), h("span.stamp", {}, "FICTION")),
    h("h2.section-label.sheet-title", {}, "The training parcel"),
    coach,
    h(
      "div.sheet-cols",
      {},
      h("section", { "aria-label": "Exhibit A" }, h("div.sheet-label", {}, h("h3.step-title", {}, "Exhibit A")), figure),
      h("section", { "aria-label": "Your copy" }, h("div.sheet-label", {}, h("h3.step-title", {}, "Your copy")), h("div.scroll", {}, grid.el)),
    ),
  );
  go(0);
  return sheet;
}
