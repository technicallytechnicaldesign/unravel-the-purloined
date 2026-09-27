// The Purloined Parcel primer (P1.5): how to tell knit from purl, how to mark
// them in the copy grid, and how the marker row shows which way is up. For
// players new to knitting or to codes. Every drawing is also said in words.

import { h } from "./h";
import { fabricSvg } from "../engine/fabric";
import { type Visible } from "../engine/construction";

const drawing = (chart: Visible[][], stitch: number, label: string) => {
  const el = h("div.primer-img");
  el.innerHTML = fabricSvg(chart, { seed: 4, wobble: 0.2, stitch, label }); // our own SVG
  return el;
};

const K: Visible = "knit";
const P: Visible = "purl";

/** The primer's content: four short sections, each with a drawing or a key. */
export function primer(): HTMLElement {
  // Row 0 is the bottom: marker row, two rows of message, the top row all purl.
  const parcel: Visible[][] = [
    [P, P, K, P, K, K, K],
    [K, P, K, K, P, P, K],
    [P, K, K, P, K, P, P],
    [P, P, P, P, P, P, P],
  ];
  const cell = (b: 0 | 1, colour = false) => h(`i.dcell.b${b}.primer-cell${colour ? ".colour" : ""}`, { "aria-hidden": "true" });
  return h(
    "div.primer",
    {},
    h(
      "section.primer-step",
      {},
      h("h3.step-title", {}, h("span.step-n.mono", {}, "01"), " Knit and purl"),
      drawing([[K, P]], 44, "Drawing of two stitches: on the left a knit stitch, shaped like a V; on the right a purl stitch, a small bump lying across."),
      h("p", {}, "A ", h("b", {}, "knit"), " stitch looks like a small V. A ", h("b", {}, "purl"), " stitch looks like a little bump lying across the fabric. In these parcels knit means 0 and purl means 1."),
      h("p.hint", {}, "In colour parcels it is the colour that counts: cream is A (0), red is B (1)."),
    ),
    h(
      "section.primer-step",
      {},
      h("h3.step-title", {}, h("span.step-n.mono", {}, "02"), " Mark what you see"),
      h("p.primer-key.mono", {}, cell(0), " knit, or cream: an empty square", h("br"), cell(1), " purl: a dot", h("br"), h("span.dgrid.colour.primer-inline", {}, cell(1, true)), " red, in colour parcels: a filled square"),
      h("p", {}, "Your copy starts all knit. Click a square (or move with the arrow keys and press space) to switch it. Copy what you see, row by row, the right way round as the drawing shows it; the decoder can turn it later."),
    ),
    h(
      "section.primer-step",
      {},
      h("h3.step-title", {}, h("span.step-n.mono", {}, "03"), " Find the marker row"),
      drawing(parcel, 26, "Drawing of a small parcel, 4 rows of 7 stitches. Bottom row, from the left: purl, purl, knit, purl, then knit to the end. Top row: all purl. The two rows between hold the message."),
      h("p", {}, "Every parcel has a ", h("b", {}, "marker row"), " along its bottom edge. From the left it reads purl, purl, knit, purl, then knit to the end (1 1 0 1 0 0 0). The ", h("b", {}, "top row"), " is all purl. The message sits between them."),
      h(
        "ul.primer-list",
        {},
        h("li", {}, "Marker row at the top? The parcel is upside down."),
        h("li", {}, "Reads 1 1 0 1 starting from the right instead of the left? It is mirrored."),
        h("li", {}, "Reads knit, knit, purl, knit, then purl to the end? You are seeing the wrong side, where every knit shows as purl and back again."),
      ),
      h("p.hint", {}, "Copy it as you see it either way: the decoder machine finds the marker and turns the parcel for you. Knowing the marker helps you read by hand."),
    ),
    h(
      "section.primer-step",
      {},
      h("h3.step-title", {}, h("span.step-n.mono", {}, "04"), " Read, or ask for help"),
      h("p", {}, "Each case's briefing says how the letters are made: five stitches to a letter, Morse, or something stranger. Stuck? The hints go one step at a time, and the last one switches on the decoder machine."),
    ),
  );
}
