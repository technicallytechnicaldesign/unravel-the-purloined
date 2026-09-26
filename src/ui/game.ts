// The Purloined Parcel (Phase G4 prototype): case files, a drawn piece of
// knitting, a copy grid to transcribe it, a hint ladder that ends in the
// decoder machine, and an answer check. No timers, no scores.

import { h } from "./h";
import { cellGrid } from "./cellgrid";
import { stepsView } from "./stepsview";
import { checkAnswer, LEVELS, makeCase, type Case } from "../engine/cases";
import { fabricSvg } from "../engine/fabric";
import { decodeCells } from "../engine/steps";
import { describe as describeOrientation } from "../engine/grid";
import { type Bit } from "../engine/fivebit";

const STORE = "purloined-parcel";

interface Progress {
  solved: Record<string, boolean>;
}

// Progress stays in this browser only; if storage is blocked the game still works.
function loadProgress(): Progress {
  try {
    return { solved: {}, ...JSON.parse(localStorage.getItem(STORE) ?? "{}") };
  } catch {
    return { solved: {} };
  }
}
function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(p));
  } catch {
    /* private window or blocked storage: progress is simply not kept */
  }
}

const newSeed = () => 1 + Math.floor(Math.random() * 999);

export function mountGame(root: HTMLElement): void {
  const progress = loadProgress();

  const showList = () => {
    root.replaceChildren(
      h("p.note", {}, "Five case files, each teaching one idea. Open any of them; each can be played again with a new parcel."),
      h(
        "ol.cases",
        {},
        ...LEVELS.map((l) =>
          h(
            "li.case-card",
            {},
            h("p.mono.case-n", {}, `CASE FILE 0${l.n}`, progress.solved[l.n] ? h("span.stamp.stamp-small", {}, "SOLVED") : ""),
            h("h3.step-title", {}, l.name),
            h("p.hint", {}, l.teaches),
            h("button.btn", { type: "button", onclick: () => showCase(makeCase(l.n, newSeed())) }, "Open the file →"),
          ),
        ),
      ),
    );
  };

  const showCase = (c: Case) => {
    const colour = c.settings.carrier.id === "two-colour";
    const rows = c.shown.length;
    const cols = c.shown[0]!.length;
    let zoom = 1;
    const figure = h("div.scroll.evidence-img");
    const svg = fabricSvg(c.shown, {
      seed: c.seed,
      stitch: 30,
      colours: { A: "#f9f6ee", B: "#c8201e" },
      label: `Evidence photograph: knitted fabric, ${rows} rows of ${cols} stitches. A description in words follows.`,
    });
    figure.innerHTML = svg; // our own SVG, no outside text in it
    const setZoom = (z: number) => {
      zoom = Math.min(3, Math.max(0.6, z));
      const el = figure.querySelector("svg")!;
      el.style.width = `${Math.round(Number(el.getAttribute("width")) * zoom)}px`;
      el.style.height = "auto";
    };

    const machine = h("div.machine");
    const grid = cellGrid({
      cells: Array.from({ length: rows }, () => new Array<Bit>(cols).fill(0)),
      label: "Your copy of the evidence",
      colour,
      onChange: () => runMachine(),
    });
    let hintsShown = 0;
    const hintList = h("ol.hints");
    const hintBtn = h("button.btn", { type: "button" }, `Take a hint (1 of ${c.hints.length})`);
    const runMachine = () => {
      if (hintsShown < c.hints.length) return;
      machine.replaceChildren(h("h3.step-title", {}, "The decoder machine"), stepsView(decodeCells(grid.get(), c.settings.layout.border, c.settings.encoding), c.settings.encoding, grid));
    };
    hintBtn.addEventListener("click", () => {
      if (hintsShown >= c.hints.length) return;
      hintList.append(h("li", {}, c.hints[hintsShown]!));
      hintsShown++;
      hintBtn.textContent = hintsShown < c.hints.length ? `Take a hint (${hintsShown + 1} of ${c.hints.length})` : "No more hints: the decoder machine is on";
      hintBtn.toggleAttribute("disabled", hintsShown >= c.hints.length);
      runMachine();
    });

    const answer = h("input", { type: "text", name: "answer", autocomplete: "off", spellcheck: "false", "aria-describedby": "verdict" });
    const verdict = h("p.verdict", { id: "verdict", role: "status" });
    const form = h(
      "form.answer",
      {
        onsubmit: (ev: Event) => {
          ev.preventDefault();
          if (checkAnswer(c, answer.value)) {
            progress.solved[c.level.n] = true;
            saveProgress(progress);
            const extra =
              c.level.n === 2 ? ` The parcel was photographed ${describeOrientation(c.orientation)}.`
              : c.mistake ? ` The slipped stitch was row ${c.mistake[0] + 1}, stitch ${cols - c.mistake[1]}.`
              : "";
            verdict.className = "verdict solved";
            verdict.replaceChildren(h("span.stamp", {}, "SOLVED"), ` "${c.answer}".${extra}`);
          } else {
            verdict.className = "verdict";
            verdict.textContent = "Not yet. Check the marker row, the reading direction, and the groups. Take a hint whenever you like.";
          }
        },
      },
      h("label.field", {}, h("span.mono.field-label", {}, "THE MESSAGE READS"), answer),
      h("button.btn.btn-go", { type: "submit" }, "Check →"),
    );

    root.replaceChildren(
      h("button.btn", { type: "button", onclick: showList }, "← All case files"),
      h("div.case-head", {}, h("p.mono", {}, `CASE FILE 0${c.level.n} / PARCEL ${String(c.seed).padStart(3, "0")}`), h("span.stamp", {}, "FICTION")),
      h("h2.section-label", {}, c.title),
      ...c.briefing.map((b) => h("p.brief.mono", {}, b)),
      h("h3.step-title", {}, "Exhibit A"),
      h("div.actions", {}, h("button.btn", { type: "button", onclick: () => setZoom(zoom * 1.25) }, "Zoom in"), h("button.btn", { type: "button", onclick: () => setZoom(zoom / 1.25) }, "Zoom out")),
      figure,
      h("details.more", {}, h("summary.mono", {}, "DESCRIBE THE IMAGE IN WORDS"), h("pre.description.mono", {}, c.description)),
      h("h3.step-title", {}, "Your copy"),
      h("p.hint", {}, `Mark each stitch as you see it in the image: ${colour ? "switch red stitches to dark" : "switch purl bumps on"}. Row 1 is the bottom row of the image.`),
      h("div.scroll", {}, grid.el),
      h("div.actions", {}, hintBtn),
      hintList,
      machine,
      form,
      verdict,
      h("div.actions", {}, h("button.btn", { type: "button", onclick: () => showCase(makeCase(c.level.n, newSeed())) }, "Another parcel like this")),
    );
    root.scrollIntoView({ behavior: "smooth" });
  };

  showList();
}
