// Selected-option field notes for the lab. These illustrations only explain
// the controls; the encoder and carrier functions remain the source of truth.

import { h } from "./h";
import { encode as fiveBit } from "../engine/fivebit";
import { encode as bacon } from "../engine/bacon";
import { PACKS, type GlyphPack } from "../engine/glyphs";
import { type Alphabet } from "../engine/alphabet";

type Guide = { title: string; first: string; second: string; drawing: HTMLElement };

const cells = (bits: readonly number[], letters = false) => {
  const row = h(`div.guide-cells${letters ? ".letters" : ""}`, { role: "img", "aria-label": letters ? bits.map((b) => b ? "B" : "A").join("") : bits.join("") });
  for (const bit of bits) row.append(h(`span.guide-cell${bit ? ".on" : ""}`, {}, letters ? bit ? "B" : "A" : ""));
  return row;
};

const grid = (rows: readonly (readonly number[])[], label: string) => {
  const drawing = h("div.guide-grid", { role: "img", "aria-label": label });
  drawing.style.setProperty("--guide-cols", String(rows[0]?.length ?? 1));
  for (const row of rows) for (const bit of row) drawing.append(h(`i.guide-grid-cell${bit ? ".on" : ""}`));
  return drawing;
};

export function transformGuide(value: string, custom?: Alphabet): Guide {
  if (value === "fivebit") return {
    title: "L / FIVE STITCHES", first: "Each letter becomes five 0 or 1 cells; L reads 01011.",
    second: "The chosen carrier turns those cells into visible stitches, and optional checks add cells that help locate a slip.",
    drawing: cells(fiveBit("L")),
  };
  if (value === "morse") return {
    title: "A / DOT DASH", first: "Morse turns a letter into a run of dots and dashes; A is dot, dash.",
    second: "Spaces between marks, letters and words matter, so the knitted chart includes those gaps.",
    drawing: h("div.guide-morse", { role: "img", "aria-label": "A in Morse: dot dash" }, h("span", {}, "·"), h("span", {}, "━")),
  };
  if (value.startsWith("bacon-")) {
    const historical = value === "bacon-historical24";
    return {
      title: "B / AAAAB", first: "Bacon gives each letter five A or B choices; B is AAAAB.",
      second: historical ? "The historical alphabet shares codes for I/J and U/V, and leaves spaces out." : "This modern variant keeps all 26 letters distinct, and leaves spaces out.",
      drawing: cells(bacon("B", historical ? "historical24" : "modern26"), true),
    };
  }
  if (value === "glyph-custom" && custom) {
    const letter = custom.symbols.A ? "A" : Object.keys(custom.symbols).find((ch) => ch !== " ");
    const rows = letter ? custom.symbols[letter] : undefined;
    return {
      title: `${letter ?? "ONE SYMBOL"} / YOUR ALPHABET`, first: "Each character uses the symbol you drew in the alphabet designer.",
      second: "The drawing is read as visible cells, then the carrier gives those cells a fabric appearance.",
      drawing: rows ? grid(rows.map((row) => [...row].map((ch) => ch === "x" ? 1 : 0)), `${letter} in your alphabet`) : cells([0, 1, 0, 1]),
    };
  }
  const pack = value.slice(6) as GlyphPack;
  const chosen = PACKS[pack];
  if (chosen) return {
    title: `A / ${chosen.size} × ${chosen.size} STITCHES`, first: pack === "pixel5" ? "Each letter is drawn as a small readable picture." : "Each letter is a geometric symbol designed for this lab.",
    second: pack === "geometric4" ? "The larger symbols can repair one changed cell and report it." : pack === "geometric3" ? "A changed cell can be noticed, though the intended symbol may still be uncertain." : "The cells become stitches or colours when you choose a carrier.",
    drawing: grid([...chosen.glyphs.A!].reverse(), `A in the ${chosen.name} alphabet`),
  };
  return transformGuide("fivebit");
}

const carrierExamples: Record<string, { title: string; first: string; second: string; left: string; right: string }> = {
  "purl-relief": { title: "KNIT / PURL", first: "The two logical cell states become a knit V or a purl bump on the right side of the fabric.", second: "The written rows translate that visible result into the needle actions for your chosen construction.", left: "V", right: "●" },
  "two-colour": { title: "COLOUR A / COLOUR B", first: "The same two states become two yarn colours instead of two stitch textures.", second: "The colour names are yours to set; the chart marks every switch between A and B.", left: "A", right: "B" },
  cable: { title: "LEFT / RIGHT CROSS", first: "Each logical cell becomes a small cable block whose crossing direction carries its state.", second: "A block takes several stitches and rows, so the finished piece grows wider and taller.", left: "╲", right: "╱" },
  lace: { title: "LEFT / RIGHT LEAN", first: "Each state becomes a lace block with an eyelet and a decrease leaning one way or the other.", second: "The lean is what you read back; each cell occupies a block of stitches.", left: "○╲", right: "╱○" },
  bobble: { title: "PLAIN / BOBBLE", first: "A plain block and a raised bobble block carry the two cell states.", second: "The raised texture makes a mark you can feel as well as see.", left: "·", right: "●" },
  bead: { title: "PLAIN / BEAD", first: "A plain block and a beaded block carry the two cell states.", second: "The bead is the visible mark; the chart and written rows show where it belongs.", left: "·", right: "◆" },
  stripes: { title: "ROW A / ROW B", first: "Morse marks become runs of rows in the two yarn colours.", second: "Read the stripe lengths from the cast-on edge; the width of each row can suit your project.", left: "A", right: "B" },
};

export function carrierGuide(value: string): Guide {
  const info = carrierExamples[value] ?? carrierExamples["purl-relief"]!;
  return {
    title: info.title, first: info.first, second: info.second,
    drawing: h("div.guide-pair", { role: "img", "aria-label": `State 0: ${info.left}; state 1: ${info.right}` },
      h("div", {}, h("span.guide-state.mono", {}, "0"), h(`span.guide-swatch.${value}.zero`, {}, info.left)),
      h("div", {}, h("span.guide-state.mono", {}, "1"), h(`span.guide-swatch.${value}.one`, {}, info.right))),
  };
}

let nextId = 0;
export function choiceHelp(label: string, read: () => Guide): { el: HTMLElement; update(): void } {
  const id = `choice-help-${++nextId}`;
  const button = h("button.guide-trigger.mono", { type: "button", "aria-label": `How ${label.toLowerCase()} works`, "aria-controls": id, "aria-expanded": "false" }, "i");
  const panel = h("div.guide-panel", { id, role: "note", hidden: true });
  const el = h("div.guide-help", {}, button, panel);
  let pinned = false;
  const visible = (show: boolean) => {
    panel.hidden = !show;
    button.setAttribute("aria-expanded", String(show));
  };
  const update = () => {
    const guide = read();
    panel.replaceChildren(h("p.guide-title.mono", {}, `FIELD NOTE / ${guide.title}`), h("p", {}, guide.first), h("p", {}, guide.second), guide.drawing);
  };
  el.addEventListener("pointerenter", () => visible(true));
  el.addEventListener("pointerleave", () => { if (!pinned) visible(false); });
  el.addEventListener("focusin", () => visible(true));
  el.addEventListener("focusout", () => { if (!pinned) visible(false); });
  button.addEventListener("click", () => { pinned = !pinned; visible(pinned); });
  document.addEventListener("pointerdown", (event) => { if (!el.contains(event.target as Node)) { pinned = false; visible(false); } });
  update();
  return { el, update };
}
