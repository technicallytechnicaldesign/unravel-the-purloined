// T09 encode tool: settings in, every pipeline stage out, in order.

import { h, download, svgToPng } from "./h";
import { carrierControls, cipherControls, constructionControl, encodingControls, field, secureControls, select } from "./controls";
import { encrypt, OVERHEAD, toLetters } from "../engine/secure";
import { fromRecipe, RECIPES, type RecipeId } from "../engine/recipes";
import { PATTERNS, patternsFor, type StitchPattern } from "../engine/stitches";
import { DENSITY_TEXT, FILLER_TEXTURE, type FillerId } from "../engine/stego";
import { MOTIFS, type MotifId } from "../engine/motifs";
import { describeKey, exportKey } from "../engine/key";
import { createProject, exportProject, type Project } from "../engine/project";
import { chartSvg } from "../engine/chartsvg";
import { chartCsv, workbook } from "../engine/xlsx";
import { describeStream } from "../engine/steps";
import { type CellRole } from "../engine/grid";
import { type Bit } from "../engine/fivebit";
import { type Alphabet } from "../engine/alphabet";

const ROLE_TEXT: Record<CellRole, string> = {
  data: "message",
  pad: "end padding (a 1, then 0s)",
  marker: "orientation marker",
  top: "top row",
  border: "border",
  filler: "filler (not message)",
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

export function mountEncoder(root: HTMLElement, sendToDecoder: (p: Project) => void): { useAlphabet(a: Alphabet): void } {
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
  const hideMode = select("hide", [["off", "Off: a plain chart"], ["scatter", "Scatter in a filler"], ["motif", "Motifs"]]);
  const filler = select("filler", []);
  const density = select("density", Object.entries(DENSITY_TEXT).map(([k, v]) => [k, v] as [string, string]), "3");
  const seed = h("input", { type: "number", name: "seed", value: 1 + Math.floor(Math.random() * 9999), min: 1, max: 999999, inputmode: "numeric" });
  const motif = select("motif", Object.values(MOTIFS).map((m) => [m.id, m.name] as [string, string]));
  const scatterBox = h("div", {}, field("FILLER", filler, "Regular patterns make message stitches stand out as small mistakes; random texture hides them best."), field("DENSITY", density), h("div.pair", {}, field("SEED", seed), h("button.btn.btn-small", { type: "button", onclick: () => ((seed.value = String(1 + Math.floor(Math.random() * 999999))), render()) }, "New seed")));
  const motifBox = h(
    "div",
    {},
    field("MOTIF", motif),
    h("p.hint", {}, "Each cell of the message grid becomes one motif; a filled centre is 1."),
    h("p.hint", {}, "Motifs make the fabric several times bigger than the message grid: best for large pieces such as a blanket, a jumper or a shirt, where the pattern has room to look like pattern."),
  );
  const hideNote = h("p.hint", {}, "Steganography hides that a message is there. It does not protect what it says: add a cipher for that, and keep the key apart from the knitting.");
  const syncHide = () => {
    scatterBox.hidden = hideMode.value !== "scatter";
    motifBox.hidden = hideMode.value !== "motif";
  };
  const out = h("ol.steps");

  // Border and edge patterns depend on the carrier: knit/purl textures or two colours.
  const fillPatterns = () => {
    const carrier = car.get().id;
    const keepFiller = filler.value;
    filler.replaceChildren(h("option", { value: "texture" }, FILLER_TEXTURE), ...patternsFor(carrier).map((k) => h("option", { value: k }, PATTERNS[k].name)));
    filler.value = [...filler.options].some((o) => o.value === keepFiller) ? keepFiller : "texture";
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
    const secure = sec.on();
    cip.el.hidden = secure;
    if (secure && !sec.passphrase()) {
      out.replaceChildren(h("li.step", {}, h("p.error", {}, "Type a passphrase for secure mode.")));
      return;
    }
    const want = `${message.value}\u0000${sec.passphrase()}`;
    if (secure && sealed?.for !== want) {
      seal(want);
      out.replaceChildren(h("li.step", {}, h("p.hint", { role: "status" }, "Sealing the message. Turning the passphrase into a key is slow on purpose, so guessing is slow too.")));
      return;
    }
    const cipher = secure ? undefined : cip.get();
    const depth = Math.max(0, Math.min(8, Math.round(Number(borderDepth.value)) || 0));
    const style = borderStyle.value as StitchPattern | "plain";
    const edgeStyle = (edgePattern.value === "plain" ? style : edgePattern.value) as StitchPattern | "plain";
    const below = Math.max(0, Math.round(Number(edgeBelow.value)) || 0);
    const above = Math.max(0, Math.round(Number(edgeAbove.value)) || 0);
    let p: Project;
    try {
      p = createProject({
        title: title.value || "Untitled",
        message: secure ? sealed!.letters : message.value,
        ...(secure ? { secure: { version: 1 as const } } : {}),
        encoding: enc.get(),
        ...(enc.glyphs() ? { glyphs: enc.glyphs()! } : {}),
        layout: { width: w, border: depth > 0, borderWidth: depth },
        ...(style !== "plain" ? { borderStyle: style } : {}),
        ...(edgeStyle !== "plain" && below + above > 0 ? { edges: { below, above, pattern: edgeStyle } } : {}),
        ...(recipe.value !== "none" ? { recipe: recipe.value as RecipeId } : {}),
        ...(hideMode.value === "scatter"
          ? { hide: { mode: "scatter" as const, seed: Math.max(1, Math.round(Number(seed.value)) || 1), filler: filler.value as FillerId, density: Number(density.value) as 2 | 3 | 4 } }
          : hideMode.value === "motif"
            ? { hide: { mode: "motif" as const, motif: motif.value as MotifId } }
            : {}),
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
    const matches = p.output.decoded === p.message.normalized;

    out.replaceChildren(
      p.settings.secure
        ? step(
            next(),
            "Encrypt (AES-GCM)",
            h("p.mono.big.wrap", {}, p.message.normalized),
            h("p.hint", {}, `${sealed!.bytes} bytes of message plus ${OVERHEAD} bytes of format, salt, nonce and tag, written as two letters per byte. Even a short message makes a big piece: this suits a blanket or a jumper.`),
            h("p.hint", {}, "Every change to the message or passphrase seals it afresh with a new random salt and nonce, so the letters change too. That is expected."),
            ...p.message.notes.map((n) => h("p.hint", {}, n)),
          )
        : step(
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
        p.settings.glyphs ? "Draw the letters" : e.alphabet === "fivebit" ? "Encode and add error checks" : e.alphabet === "morse" ? (p.settings.carrier.id === "stripes" ? "Encode as Morse, then stripes" : "Encode as Morse") : "Encode as A/B groups",
        ...(p.settings.glyphs
          ? [h("p.hint", {}, "Each character becomes its own small picture, with one stitch of space between them and one row between lines.")]
          : [h("p.hint", {}, `${p.output.bits.length} cells in the stream.`), symbolTable(p)]),
        ...(p.settings.carrier.id === "stripes" ? [h("p.hint", {}, "Each Morse unit becomes two rows: 1 is colour B, 0 is colour A. Four plain rows go before and after.")] : []),
      ),
      step(
        next(),
        "Logical grid",
        h(
          "p.hint",
          {},
          p.output.key
            ? `${p.output.logicalGrid.length} rows of ${p.output.logicalGrid[0]?.length ?? 0} cells. The message cells are shown dark and light; everything dimmed is filler or border.`
            : p.settings.glyphs
              ? `${p.output.logicalGrid.length} rows of ${p.output.logicalGrid[0]?.length ?? 0} cells. Read left to right, top line first; there is no marker row, since letters show which way is up.`
              : p.settings.carrier.id === "stripes"
                ? `${p.output.logicalGrid.length} rows, one colour each. Row 1 at the bottom is the cast-on edge; read upwards from there.`
                : `${p.output.logicalGrid.length} rows of ${p.output.logicalGrid[0]?.length ?? 0} cells. Row 1 at the bottom. The message runs right to left from the bottom, between the marker row and the top row.`,
        ),
        h("div.scroll", {}, logicalGrid(p.output.logicalGrid, p.output.roles)),
        h("p.legend.mono", {}, h("span", {}, h("i.lcell.b1.role-data"), " message 1"), h("span", {}, h("i.lcell.b0.role-data"), " message 0"), h("span", {}, h("i.lcell.b1.role-marker"), p.output.key || p.settings.glyphs ? " background and border" : " marker, top, border, padding")),
      ),
      p.output.key
        ? step(
            next(),
            "Hide",
            h("p.hint", {}, "The chart below looks like pattern. Only a reader with this key can find the message in it."),
            h("p.mono.big.key-code", {}, p.output.keyCode!),
            ...describeKey(p.output.key).map((l) => h("p.hint", {}, l)),
            h(
              "div.actions",
              {},
              h("button.btn", { type: "button", onclick: () => printKeyCard(p) }, "Print the key card"),
              h("button.btn", { type: "button", onclick: () => download(`${slug(p)}-key.json`, "application/json", exportKey(p.output.key!)) }, "Key (JSON)"),
            ),
          )
        : "",
      step(next(), "Chart", h("div.scroll.chart-svg", { role: "img", "aria-label": "Knitting chart" }), ...p.output.carrierNotes.map((n) => h("p.hint", {}, n))),
      step(
        next(),
        method === "round" ? "Knit it: rounds" : "Knit it: rows",
        h("p.hint", {}, "Work each line as written; right side and wrong side are already handled."),
        ...p.output.preamble.map((line) => h("p.mono.section-line", {}, line)),
        ...(p.output.abbreviations.length ? [h("div.abbrev", {}, h("p.mono.field-label", {}, "ABBREVIATIONS"), ...p.output.abbreviations.map((a) => h("p.hint", {}, a)))] : []),
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
                  workbook({ title: p.settings.title, chart: p.output.chart, rows: p.output.rows, method, legend: p.output.legend, instructions: [...p.output.preamble, ...p.output.instructions, ...p.output.finishing], notes: [...p.message.notes, ...p.output.carrierNotes, ...p.output.abbreviations, p.output.dimensions] }),
                ),
            },
            "Spreadsheet (XLSX)",
          ),
          h("button.btn", { type: "button", onclick: () => download(`${slug(p)}-chart.csv`, "text/csv", chartCsv(p.output.chart)) }, "Chart (CSV)"),
          h("button.btn", { type: "button", onclick: () => download(`${slug(p)}.json`, "application/json", exportProject(p)) }, "Project (JSON)"),
        ),
        h("div.actions", {}, h("button.btn", { type: "button", onclick: () => sendToDecoder(p) }, "Open it in the decoder →")),
      ),
    );
    // The SVG is our own output, built from escaped text only.
    out.querySelector(".chart-svg")!.innerHTML = svg;
  };

  const enc = encodingControls(render);
  const car = carrierControls(() => (fillPatterns(), recipe.value !== "none" && applyRecipe(), render()), true);
  const con = constructionControl(render);
  const cip = cipherControls(render);
  const sec = secureControls(render, "Keep the error checks on: one misread letter and the message will not open. Hamming repairs one cell per letter.");
  // The sealed letters for the current message and passphrase. Sealing is async and slow on purpose,
  // so it waits for typing to pause, and a newer request wins over an older one.
  let sealed: { for: string; letters: string; bytes: number } | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let ticket = 0;
  const seal = (want: string) => {
    clearTimeout(pending);
    const mine = ++ticket;
    pending = setTimeout(async () => {
      const [text, pass] = want.split("\u0000") as [string, string];
      try {
        const bytes = await encrypt(text, pass);
        if (mine !== ticket) return;
        sealed = { for: want, letters: toLetters(bytes), bytes: bytes.length - OVERHEAD };
        render();
      } catch (err) {
        if (mine === ticket) out.replaceChildren(h("li.step", {}, h("p.error", {}, err instanceof Error ? err.message : String(err))));
      }
    }, 400);
  };
  fillPatterns();
  applyRecipe();
  for (const el of [message, title, width, borderDepth, edgeBelow, edgeAbove]) el.addEventListener("input", render);
  for (const el of [borderStyle, edgePattern, filler, density, motif]) el.addEventListener("change", render);
  seed.addEventListener("input", render);
  hideMode.addEventListener("change", () => (syncHide(), render()));
  syncHide();
  recipe.addEventListener("change", () => (applyRecipe(), render()));

  // A photo frame: a solid border in colour B that the decoder's photo reader can find by itself.
  const frameNote = h("p.hint", {});
  const frameBtn = h(
    "button.btn.btn-small",
    {
      type: "button",
      onclick: () => {
        borderDepth.value = String(Math.max(2, Number(borderDepth.value) || 0));
        borderStyle.value = "solid-b";
        render();
        refreshSums();
      },
    },
    "Use a photo frame",
  );
  const syncFrame = () => {
    const colour = car.get().id === "two-colour";
    frameBtn.disabled = !colour;
    frameNote.textContent = colour
      ? "A solid border in colour B, at least 2 stitches deep, is a frame the decoder can find in a photo by itself. It is a look as much as a tool: skip it and tap the corners instead."
      : "Photo frames need two colours: choose the two-colour carrier, or tap the corners when reading a photo.";
  };
  const frameBox = h("div", {}, h("div.actions", {}, frameBtn), frameNote);

  // Two ways in: start from the words, or from the piece to knit. Stages open one at a time and
  // fold to a one-line summary; the pattern appears once the last stage is done.
  type Path = "message" | "knit";
  const chosen = (el: HTMLElement, name: string) => el.querySelector<HTMLSelectElement>(`select[name="${name}"]`)?.selectedOptions[0]?.text ?? "";
  const recipeField = field("START FROM (OPTIONAL)", recipe);
  const blocks: Record<string, { name: string; body: HTMLElement[]; sum: () => string }> = {
    knit: { name: "WHAT TO KNIT", body: [recipeField, recipeNote], sum: () => chosen(recipeField, "recipe") },
    message: {
      name: "MESSAGE",
      body: [field("MESSAGE", message), field("PATTERN TITLE", title)],
      sum: () => `"${message.value.trim() || "(empty)"}"`,
    },
    encode: { name: "ENCODE", body: [enc.el, cip.el, sec.el], sum: () => `${chosen(enc.el, "transform")}${sec.on() ? ", sealed with a passphrase" : cip.get() ? `, ${chosen(cip.el, "cipher")}` : ""}` },
    carrier: { name: "CARRIER", body: [car.el], sum: () => chosen(car.el, "carrier") },
    size: {
      name: "SIZE AND CONSTRUCTION",
      body: [field("MESSAGE WIDTH (STITCHES)", width, "The border adds its depth on each side."), con.el],
      sum: () => `${width.value} stitches, ${chosen(con.el, "construction").toLowerCase()}`,
    },
    border: {
      name: "BORDER AND EDGES",
      body: [
        h("div.pair", {}, field("BORDER DEPTH", borderDepth, "0 for none."), field("BORDER PATTERN", borderStyle)),
        h("div.pair", {}, field("PLAIN ROWS BELOW", edgeBelow), field("PLAIN ROWS ABOVE", edgeAbove)),
        field("EDGE PATTERN", edgePattern, "Edge rows are rounded up to even numbers so row 1 of the chart stays on the right side."),
        frameBox,
      ],
      sum: () => (Number(borderDepth.value) > 0 ? `Border ${borderDepth.value} deep, ${(borderStyle.selectedOptions[0]?.text ?? "").toLowerCase()}` : "No border"),
    },
    hide: { name: "HIDE (OPTIONAL)", body: [field("HIDE THE MESSAGE", hideMode), scatterBox, motifBox, hideNote], sum: () => hideMode.selectedOptions[0]?.text ?? "" },
  };
  type Block = "knit" | "message" | "encode" | "carrier" | "size" | "border" | "hide";
  const ORDER: Record<Path, Block[]> = { message: ["message", "encode", "carrier", "size", "border", "hide"], knit: ["knit", "message", "encode", "carrier", "size", "border", "hide"] };

  let path: Path | undefined;
  const stages = h("div.stages");
  const sums: (() => void)[] = [];
  const refreshSums = () => sums.forEach((f) => f());
  const showPattern = () => {
    out.hidden = false;
    stages.querySelectorAll("details").forEach((d) => (d.open = false));
    render();
    out.scrollIntoView({ behavior: "smooth" });
  };
  const build = () => {
    const order = ORDER[path!];
    sums.length = 0;
    // In the knit path the piece comes first and is required; otherwise it is an optional start in the size stage.
    recipeField.querySelector(".field-label")!.textContent = path === "knit" ? "PIECE" : "START FROM (OPTIONAL)";
    recipe.options[0]!.hidden = path === "knit";
    if (path === "knit" && recipe.value === "none") (recipe.value = recipe.options[1]!.value), applyRecipe(), render();
    blocks.size!.body.splice(2);
    if (path === "message") blocks.size!.body.push(recipeField, recipeNote);
    stages.replaceChildren(
      ...order.map((key, i) => {
        const b = blocks[key]!;
        const sum = h("span.stage-sum", {});
        sums.push(() => (sum.textContent = b.sum()));
        const last = i === order.length - 1;
        const next = h(
          "button.btn" + (last ? ".btn-go" : ""),
          {
            type: "button",
            onclick: () => {
              if (last) return showPattern();
              const all = stages.querySelectorAll("details");
              all[i]!.open = false;
              all[i + 1]!.open = true;
              all[i + 1]!.querySelector("summary")!.focus();
            },
          },
          last ? "Make the pattern →" : `Next: ${blocks[order[i + 1]!]!.name.toLowerCase()} →`,
        );
        const d = h(
          "details.stage",
          { name: "lab-stage", open: i === 0 },
          h("summary", {}, h("span.step-n.mono", {}, String(i + 1).padStart(2, "0")), h("span.stage-name.mono", {}, b.name), sum),
          h("div.stage-body", {}, ...b.body, h("div.actions", {}, next)),
        );
        // Older browsers ignore name=: keep one stage open by hand.
        d.addEventListener("toggle", () => d.open && stages.querySelectorAll("details").forEach((o) => o !== d && (o.open = false)));
        return d;
      }),
    );
    refreshSums();
  };
  const pathNote = h("p.path-note.mono", { hidden: true });
  const choose = (p: Path) => {
    path = p;
    paths.hidden = true;
    pathNote.hidden = false;
    pathNote.replaceChildren(
      p === "message" ? "STARTING FROM A MESSAGE " : "STARTING FROM THE PIECE ",
      h("button.linkish", { type: "button", onclick: () => ((paths.hidden = false), (pathNote.hidden = true), paths.querySelector("button")!.focus()) }, "change"),
    );
    build();
    stages.querySelector("summary")!.focus();
  };
  const paths = h(
    "div.paths",
    { role: "group", "aria-label": "How do you want to start?" },
    h("button.path", { type: "button", onclick: () => choose("message") }, h("b", {}, "I have a message to encode"), h("span", {}, "Start with the words, then choose how to knit them.")),
    h("button.path", { type: "button", onclick: () => choose("knit") }, h("b", {}, "I want to knit a..."), h("span", {}, "Scarf, cowl, hat band or swatch: start with the piece, then add a message.")),
  );
  const form = h("form.builder", { onsubmit: (ev: Event) => (ev.preventDefault(), showPattern()) }, paths, pathNote, stages);
  form.addEventListener("input", refreshSums);
  form.addEventListener("change", refreshSums);
  form.addEventListener("change", syncFrame);
  syncFrame();
  out.hidden = true;
  root.append(form, out);
  render();
  return { useAlphabet: (a) => (enc.setCustom(a), render()) };
}

const slug = (p: Project) => (p.settings.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pattern");

/** Fill the print sheet with the pattern and open the browser's print dialog, where "Save as PDF" lives. */
function printPattern(p: Project, svg: string): void {
  const footer = p.settings.secure ? "Encrypted with AES-GCM from a passphrase. The passphrase is not on this sheet: pass it on some other way." : "Encoded is not encrypted. A modern reconstruction made at the lab.";
  const sheet = document.querySelector<HTMLElement>("#print-sheet")!;
  const stitches = p.output.chart[0]?.length ?? 0;
  const method = p.settings.construction.method;
  sheet.replaceChildren(
    h("p.mono", {}, "UNRAVEL THE PURLOINED / PATTERN"),
    h("h1", {}, p.settings.title),
    h("p", {}, `${stitches} stitches, ${method === "round" ? "worked in the round" : "worked flat"}. Row 1 is at the bottom of the chart, stitch 1 on the right. ${p.output.dimensions}`),
    h("div.print-chart"),
    ...(p.output.abbreviations.length ? [h("h2", {}, "Abbreviations"), ...p.output.abbreviations.map((a) => h("p.mono", {}, a))] : []),
    h("h2", {}, method === "round" ? "Rounds" : "Rows"),
    ...p.output.preamble.map((l) => h("p.mono", {}, l)),
    h("ol.instructions.mono", {}, ...p.output.instructions.map((l) => h("li", {}, l))),
    ...p.output.finishing.map((l) => h("p.mono", {}, l)),
    ...[...p.message.notes, ...p.output.carrierNotes, ...p.output.checks].map((n) => h("p", {}, n)),
    h("p.mono", {}, footer),
  );
  sheet.querySelector(".print-chart")!.innerHTML = svg;
  window.print();
}

/** Fill the print sheet with the parcel key card and open the print dialog. */
function printKeyCard(p: Project): void {
  const sheet = document.querySelector<HTMLElement>("#print-sheet")!;
  sheet.replaceChildren(
    h("p.mono", {}, "UNRAVEL THE PURLOINED / PARCEL KEY"),
    h("h1", {}, p.settings.title),
    h("p.mono", {}, "KEEP THIS CARD APART FROM THE KNITTING."),
    h("p.mono.key-code", {}, p.output.keyCode!),
    ...describeKey(p.output.key!).map((l) => h("p", {}, l)),
    h("p", {}, "To read: open the lab, go to Decode a grid, open a parcel key, type the code above, then mark each stitch as you see it."),
    h("p.mono", {}, "Steganography hides that a message is there. It does not protect what it says."),
  );
  window.print();
}
