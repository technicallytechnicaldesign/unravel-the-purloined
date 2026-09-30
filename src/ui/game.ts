// The Purloined Parcel (Phase G4 prototype): case files, a drawn piece of
// knitting, a copy grid to transcribe it, a hint ladder that ends in the
// decoder machine, and an answer check. No timers, no scores.

import { h } from "./h";
import { cellGrid } from "./cellgrid";
import { stepsView } from "./stepsview";
import { checkAnswer, LEVELS, makeCase, type Case } from "../engine/cases";
import { fabricLayout, fabricSvg } from "../engine/fabric";
import { decodeCells } from "../engine/steps";
import { borderOf, describe as describeOrientation } from "../engine/grid";
import { type Bit } from "../engine/fivebit";
import { decipher, encipher } from "../engine/ciphers";
import { primer } from "./tutorial";
import { trainingSheet } from "./training";

const STORE = "purloined-parcel";
interface Progress {
  solved: Record<string, boolean>;
  /** Row by row mode, remembered for the next case. */
  rowMode?: boolean;
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
    const solved = LEVELS.filter((l) => progress.solved[l.n]).length;
    // The guide stays available above the case files and opens on request.
    const guide = h(
      "details.primer-box",
      {},
      h("summary", {}, h("h2.mono.primer-title", {}, "HOW TO READ A PARCEL")),
      primer(),
      h("div.actions", {}, h("button.btn.btn-go", { type: "button", onclick: () => { guide.open = false; guide.querySelector("summary")!.focus(); } }, "Got it: show me the cases")),
    );
    root.replaceChildren(
      guide,
      h("div.folio-head", {}, h("p.mono", {}, `FOLIO / CASE FILES 01 TO ${String(LEVELS.length).padStart(2, "0")}`), h("p.mono", {}, `${solved} OF ${LEVELS.length} SOLVED`)),
      h(
        "ol.folio",
        {},
        h(
          "li",
          {},
          h(
            "button.dossier.dossier-training",
            { type: "button", onclick: showTraining, "aria-label": "Open case file 00: the training parcel. Start here." },
            h("span.dossier-tab.mono", {}, "00"),
            h("span.stamp.stamp-small.dossier-stamp", {}, progress.solved[0] ? "SOLVED" : "START HERE"),
            h("span.dossier-name", {}, "The training parcel"),
            h("span.dossier-teaches", {}, "Read one small parcel together, step by step, with every clue pointed out."),
          ),
        ),
        ...LEVELS.map((l) =>
          h(
            "li",
            {},
            h(
              "button.dossier",
              { type: "button", onclick: () => showCase(makeCase(l.n, newSeed())), "aria-label": `Open case file ${l.n}: ${l.name}` },
              h("span.dossier-tab.mono", {}, String(l.n).padStart(2, "0")),
              progress.solved[l.n] ? h("span.stamp.stamp-small.dossier-stamp", {}, "SOLVED") : "",
              h("span.dossier-name", {}, l.name),
              h("span.dossier-teaches", {}, l.teaches),
            ),
          ),
        ),
      ),
      h("p.hint", {}, "Every case can be opened again with a new parcel. Nothing is timed."),
    );
  };

  const showTraining = () => {
    root.replaceChildren(
      trainingSheet({
        back: showList,
        solved: () => ((progress.solved[0] = true), saveProgress(progress)),
        next: () => showCase(makeCase(1, newSeed())),
      }),
    );
    root.scrollIntoView({ behavior: "smooth" });
  };

  const showCase = (c: Case) => {
    const colour = c.settings.carrier.id === "two-colour";
    const rows = c.shown.length;
    const cols = c.shown[0]!.length;
    let zoom = 1;
    const figure = h("div.scroll.evidence-img", { tabindex: 0, role: "region", "aria-label": "Evidence photograph, scrolls" });
    const look = { seed: c.seed, stitch: c.tiles || c.blocks ? 16 : 30, colours: { A: "#f9f6ee", B: "#c8201e" } };
    const svg = fabricSvg(c.shown, { ...look, label: `Evidence photograph: knitted fabric, ${rows} rows of ${cols} stitches. A description in words follows.` });
    figure.innerHTML = svg; // our own SVG, no outside text in it
    const setZoom = (z: number) => {
      zoom = Math.min(3, Math.max(0.5, z));
      const el = figure.querySelector("svg")!;
      el.style.width = `${Math.round(Number(el.getAttribute("width")) * zoom)}px`;
      el.style.height = "auto";
      if (rowMode) showRow(row);
    };

    const machine = h("div.machine", {}, h("p.hint", {}, `Locked. It switches on with hint ${c.machineAfter}.`));
    const grid = cellGrid({
      cells: Array.from({ length: c.blocks?.rows ?? c.tiles?.rows ?? rows }, () => new Array<Bit>(c.blocks?.cols ?? c.tiles?.cols ?? cols).fill(0)),
      label: "Your copy of the evidence",
      colour,
      onChange: () => runMachine(),
    });
    // Row by row: the copy shows one row, with the matching strip of the evidence cropped above it,
    // so a phone never has to scroll between the picture and the grid.
    const copyRows = grid.get().length;
    const per = rows / copyRows; // fabric rows per copy row: 1, or a block or tile's height
    const bands = fabricLayout(c.shown, look);
    let rowMode = !!progress.rowMode;
    let row = 0;
    const rowStyle = h("style");
    const strip = h("div.scroll.row-strip", { role: "img" });
    const rowLabel = h("span.mono.row-label", { "aria-live": "polite" });
    const below = h("button.btn.btn-small", { type: "button", onclick: () => showRow(row - 1) }, "↓ Row below");
    const above = h("button.btn.btn-small", { type: "button", onclick: () => showRow(row + 1) }, "Row above ↑");
    const bench = h("div.row-bench", { hidden: true }, strip, h("div.row-nav", {}, below, rowLabel, above));
    const showRow = (r: number) => {
      row = Math.max(0, Math.min(copyRows - 1, r));
      rowStyle.textContent = rowMode ? `.row-mode .dgrid > [data-row]:not([data-row="${row}"]) { display: none; }` : "";
      rowLabel.textContent = `ROW ${row + 1} OF ${copyRows}`;
      below.toggleAttribute("disabled", row === 0);
      above.toggleAttribute("disabled", row === copyRows - 1);
      if (!rowMode) return;
      // Crop a copy of the drawing to this row's band of fabric, with a sliver of the rows either side.
      const lo = Math.floor(row * per), hi = Math.floor((row + 1) * per) - 1;
      const top = bands.rows[hi]!.y, bottom = bands.rows[lo]!.y + bands.rows[lo]!.h;
      const edge = bands.rows[lo]!.h * 0.35;
      const y0 = Math.max(0, top - edge), y1 = Math.min(bands.height, bottom + edge);
      const el = figure.querySelector("svg")!.cloneNode(true) as SVGSVGElement;
      el.setAttribute("viewBox", `0 ${y0} ${bands.width} ${y1 - y0}`);
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("width", String(Math.round(bands.width * zoom)));
      el.setAttribute("height", String(Math.round((y1 - y0) * zoom)));
      el.style.width = el.style.height = "";
      strip.setAttribute("aria-label", `Row ${row + 1} of the evidence, cropped. The full description in words is under Exhibit A.`);
      strip.replaceChildren(el);
    };
    const rowToggle = h("button.btn.btn-small", { type: "button", "aria-pressed": "false" }, "Row by row");
    const setRowMode = (on: boolean) => {
      rowMode = on;
      progress.rowMode = on;
      saveProgress(progress);
      rowToggle.setAttribute("aria-pressed", String(on));
      rowToggle.textContent = on ? "Show everything" : "Row by row";
      sheet.classList.toggle("row-mode", on);
      bench.hidden = !on;
      showRow(row);
    };
    rowToggle.addEventListener("click", () => setRowMode(!rowMode));
    // Arrow keys up and down move to the next row first, so the cell they land on is visible.
    grid.el.addEventListener(
      "keydown",
      (ev) => {
        if (!rowMode || (ev.key !== "ArrowUp" && ev.key !== "ArrowDown")) return;
        showRow(row + (ev.key === "ArrowUp" ? 1 : -1));
      },
      true,
    );

    let hintsShown = 0;
    const hintList = h("ol.hints");
    const hintBtn = h("button.btn", { type: "button" }, `Take hint 1 of ${c.hints.length}`);
    const machineBox = h("details.more.fold", {}, h("summary.mono", {}, "THE DECODER MACHINE"), machine);
    const runMachine = () => {
      if (hintsShown < c.machineAfter) return;
      const s = decodeCells(grid.get(), borderOf(c.settings.layout), c.settings.encoding);
      const cipher = c.settings.cipher;
      const deciphers = cipher && c.decipherAfter !== undefined && hintsShown >= c.decipherAfter;
      machine.replaceChildren(
        stepsView(s, c.settings.encoding, grid),
        deciphers ? h("p.mono.big", {}, `Deciphered with ${cipher.key}: ${decipher(s.text, cipher) || "(nothing yet)"}`) : "",
      );
    };
    hintBtn.addEventListener("click", () => {
      if (hintsShown >= c.hints.length) return;
      hintList.append(h("li", {}, c.hints[hintsShown]!));
      hintsShown++;
      hintBtn.textContent = hintsShown < c.hints.length ? `Take hint ${hintsShown + 1} of ${c.hints.length}` : "No more hints";
      hintBtn.toggleAttribute("disabled", hintsShown >= c.hints.length);
      if (hintsShown === c.machineAfter) machineBox.open = true;
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
              : c.settings.cipher ? ` The stitches said "${encipher(c.answer, c.settings.cipher)}" until the key turned them back.`
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

    const sheet = h(
        "article.sheet",
        {},
        h(
          "header.sheet-head",
          {},
          h("button.btn.btn-small", { type: "button", onclick: showList }, "← Folio"),
          h("p.mono", {}, `CASE FILE ${String(c.level.n).padStart(2, "0")} / PARCEL ${String(c.seed).padStart(3, "0")}`),
          h("span.stamp", {}, "FICTION"),
          rowToggle,
        ),
        h("h2.section-label.sheet-title", {}, c.level.name),
        h("div.memo.mono", {}, ...c.briefing.map((b) => h("p", {}, b))),
        h(
          "div.sheet-cols",
          {},
          h(
            "section",
            { "aria-label": "Exhibit A" },
            h("div.sheet-label", {}, h("h3.step-title", {}, "Exhibit A"), h("span.zoom", {}, h("button.btn.btn-small", { type: "button", onclick: () => setZoom(zoom / 1.25), "aria-label": "Zoom out" }, "−"), h("button.btn.btn-small", { type: "button", onclick: () => setZoom(zoom * 1.25), "aria-label": "Zoom in" }, "+"))),
            figure,
            h("details.more", {}, h("summary.mono", {}, "DESCRIBE THE IMAGE IN WORDS"), h("pre.description.mono", {}, c.description)),
            h("details.more", {}, h("summary.mono", {}, "HOW TO READ A PARCEL"), primer()),
          ),
          h(
            "section",
            { "aria-label": "Your copy" },
            h("div.sheet-label", {}, h("h3.step-title", {}, "Your copy")),
            bench,
            h(
              "p.hint",
              {},
              c.blocks
                ? `One cell per block of ${c.blocks.unit === "cable" ? "six stitches" : c.blocks.unit === "lace" ? "four stitches" : "three stitches"}: switch it on for a 1. Row 1 is the bottom row of blocks.`
                : c.tiles
                ? "One cell per square: switch it on for a filled square. Row 1 is the bottom row of squares."
                : `Mark each stitch as you see it: ${colour ? "switch red stitches to dark" : "switch purl bumps on"}. Row 1 is the bottom row of the image.`,
            ),
            h("div.scroll", {}, grid.el),
            form,
            verdict,
          ),
        ),
        h("details.more.fold", {}, h("summary.mono", {}, `HINTS (${c.hints.length})`), h("div.actions", {}, hintBtn), hintList),
        machineBox,
        h("div.actions", {}, h("button.btn", { type: "button", onclick: () => showCase(makeCase(c.level.n, newSeed())) }, "Another parcel like this")),
        rowStyle,
      );
    root.replaceChildren(sheet);
    setRowMode(rowMode);
    root.scrollIntoView({ behavior: "smooth" });
  };

  showList();
}
