// The Purloined Parcel (Phase G4 prototype): case files, a drawn piece of
// knitting, a copy grid to transcribe it, a hint ladder that ends in the
// decoder machine, and an answer check. No timers, no scores.

import { h } from "./h";
import { cellGrid } from "./cellgrid";
import { stepsView } from "./stepsview";
import { checkAnswer, LEVELS, makeCase, type Case } from "../engine/cases";
import { fabricSvg } from "../engine/fabric";
import { decodeCells } from "../engine/steps";
import { borderOf, describe as describeOrientation } from "../engine/grid";
import { type Bit } from "../engine/fivebit";
import { decipher, encipher } from "../engine/ciphers";

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
    const solved = LEVELS.filter((l) => progress.solved[l.n]).length;
    root.replaceChildren(
      h("div.folio-head", {}, h("p.mono", {}, `FOLIO / CASE FILES 01 TO 0${LEVELS.length}`), h("p.mono", {}, `${solved} OF ${LEVELS.length} SOLVED`)),
      h(
        "ol.folio",
        {},
        ...LEVELS.map((l) =>
          h(
            "li",
            {},
            h(
              "button.dossier",
              { type: "button", onclick: () => showCase(makeCase(l.n, newSeed())), "aria-label": `Open case file ${l.n}: ${l.name}` },
              h("span.dossier-tab.mono", {}, `0${l.n}`),
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

  const showCase = (c: Case) => {
    const colour = c.settings.carrier.id === "two-colour";
    const rows = c.shown.length;
    const cols = c.shown[0]!.length;
    let zoom = 1;
    const figure = h("div.scroll.evidence-img");
    const svg = fabricSvg(c.shown, {
      seed: c.seed,
      stitch: c.tiles ? 16 : 30,
      colours: { A: "#f9f6ee", B: "#c8201e" },
      label: `Evidence photograph: knitted fabric, ${rows} rows of ${cols} stitches. A description in words follows.`,
    });
    figure.innerHTML = svg; // our own SVG, no outside text in it
    const setZoom = (z: number) => {
      zoom = Math.min(3, Math.max(0.5, z));
      const el = figure.querySelector("svg")!;
      el.style.width = `${Math.round(Number(el.getAttribute("width")) * zoom)}px`;
      el.style.height = "auto";
    };

    const machine = h("div.machine", {}, h("p.hint", {}, `Locked. It switches on with hint ${c.machineAfter}.`));
    const grid = cellGrid({
      cells: Array.from({ length: c.tiles?.rows ?? rows }, () => new Array<Bit>(c.tiles?.cols ?? cols).fill(0)),
      label: "Your copy of the evidence",
      colour,
      onChange: () => runMachine(),
    });
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

    root.replaceChildren(
      h(
        "article.sheet",
        {},
        h(
          "header.sheet-head",
          {},
          h("button.btn.btn-small", { type: "button", onclick: showList }, "← Folio"),
          h("p.mono", {}, `CASE FILE 0${c.level.n} / PARCEL ${String(c.seed).padStart(3, "0")}`),
          h("span.stamp", {}, "FICTION"),
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
          ),
          h(
            "section",
            { "aria-label": "Your copy" },
            h("div.sheet-label", {}, h("h3.step-title", {}, "Your copy")),
            h(
              "p.hint",
              {},
              c.tiles
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
      ),
    );
    root.scrollIntoView({ behavior: "smooth" });
  };

  showList();
}
