// The gallery wall: plates in knitted frames. A plate opens a larger view with
// the credit, content tags, and the message hidden until asked for; "try
// decoding it" opens the piece's pattern in the decoder with a blank grid.

import { h } from "./h";
import { createProject } from "../engine/project";
import { fabricSvg } from "../engine/fabric";
import { PIECES, TAGS, waiting, type Piece, type Placeholder } from "../content/gallery";

/** A drawn swatch; if `knitted` is short of the full height, the rest waits on the needle. */
function swatch(p: Placeholder, stitch: number): HTMLElement {
  const full = createProject(p.settings, `gallery-${p.plate}`).output.chart;
  const chart = p.rows ? full.slice(0, p.rows) : full;
  const el = h("div.plate-swatch");
  el.innerHTML = fabricSvg(chart, { seed: 10 + Number(p.plate), stitch, wobble: 0.6, label: p.rows ? `A drawing of a small swatch still on the needle, ${p.rows} rows knitted.` : `A drawing of a finished swatch, ${chart.length} rows of ${chart[0]!.length} stitches.` }); // our own SVG
  if (p.rows) {
    const svg = el.querySelector("svg")!;
    const w = Number(svg.getAttribute("width"));
    const needle = document.createElementNS("http://www.w3.org/2000/svg", "g");
    needle.innerHTML = `<line x1="4" y1="${stitch * 0.55}" x2="${w - 4}" y2="${stitch * 0.55}" stroke="currentColor" stroke-width="${stitch / 5}" stroke-linecap="round"/><circle cx="${w - 6}" cy="${stitch * 0.55}" r="${stitch / 4}" fill="var(--red)"/>`;
    svg.append(needle);
  }
  return el;
}

const tagChips = (tags: string[] = []) => (tags.length ? h("p.tags", {}, ...tags.map((t) => h(`span.tag.tag-${TAGS[t]?.tone ?? "plain"}.mono`, {}, TAGS[t]?.label ?? t))) : "");

/** Who made it, or the grade X note for drawings. */
const credit = (p: Piece | Placeholder) =>
  "image" in p
    ? h("p.credit.mono", {}, [p.knitter ? `KNITTED BY ${p.knitter.toUpperCase()}` : "", p.handle ?? "", p.date].filter(Boolean).join(" / "))
    : h("p.credit.mono", {}, h("span.badge.badge-x", {}, "X"), " A DRAWING, NOT YET KNITTED");

/** The message, hidden, with a way to try it and a way to just see it. */
function messageBox(plate: string, message: string | undefined, canDecode: boolean, tags: string[] = []): HTMLElement | "" {
  if (!message && !canDecode) return "";
  const shown = h("p.mono.big.reveal-text", { hidden: true, "aria-live": "polite" }, message ?? "");
  const warn = tags.includes("nsfw") ? " (NSFW)" : tags.includes("swearing") ? " (swearing)" : "";
  const reveal = h("button.btn", { type: "button" }, `Reveal the message${warn}`);
  reveal.addEventListener("click", () => ((shown.hidden = false), reveal.remove()));
  return h(
    "div.message-box",
    {},
    h("p.field-label.mono", {}, "THE MESSAGE IS HIDDEN"),
    h("p.hint", {}, canDecode ? "Have a go first: the decoder opens in a new tab with this piece's settings and an empty grid. Copy the stitches from the picture." : "Try reading it from the picture first."),
    h("div.actions", {}, canDecode ? h("a.btn.btn-go", { href: `./decode.html#plate=${plate}`, target: "_blank", rel: "noopener" }, "Try decoding it ↗") : "", message ? reveal : ""),
    shown,
  );
}

export function mountGallery(root: HTMLElement): void {
  const dialog = h("dialog.lightbox", { "aria-label": "Plate" }) as HTMLDialogElement;
  dialog.addEventListener("click", (ev) => ev.target === dialog && dialog.close()); // click outside closes
  const open = (big: () => HTMLElement, caption: () => (Node | string)[], title: string) => {
    dialog.setAttribute("aria-label", title);
    dialog.replaceChildren(
      h("button.lightbox-close", { type: "button", "aria-label": "Close", onclick: () => dialog.close() }, "×"),
      h("div.lightbox-body", {}, h("div.frame.lightbox-frame", {}, h("div.mat", {}, big())), h("div.lightbox-caption", {}, h("h2.plate-title", {}, title), ...caption())),
    );
    dialog.showModal();
  };

  // Captions are built fresh for the card and for each opening: a node can only sit in one place.
  // The stitches are only stitches: an NSFW piece gets a stamp saying so, not a blur.
  const plate = (id: string, title: string, thumb: () => HTMLElement, big: () => HTMLElement, caption: () => (Node | string)[], nsfw = false) => {
    const frame = h("button.frame.plate-frame", { type: "button", "aria-label": `Open plate ${id}: ${title}`, onclick: () => open(big, caption, `Plate ${id}: ${title}`) }, h("div.mat", {}, thumb(), nsfw ? h("span.stamp.stamp-small.nsfw-stamp", {}, "NSFW ONCE DECODED") : ""));
    return h("figure.plate", { id: `plate-${id}` }, frame, h("figcaption", {}, h("p.mono.plate-no", {}, `PLATE ${id}`), h("h2.plate-title", {}, title), ...caption().slice(0, 2)));
  };

  const real = PIECES.map((p) => {
    const img = (cls: string) => h(`img.${cls}`, { src: `${import.meta.env.BASE_URL}${p.image}`, alt: p.alt, loading: "lazy" });
    const caption = () => [credit(p), tagChips(p.tags), h("p.hint", {}, p.made), p.notes ? h("p", {}, p.notes) : "", messageBox(p.plate, p.message, !!p.pattern, p.tags)];
    return plate(p.plate, p.title, () => img("plate-img"), () => img("lightbox-img"), caption, p.tags?.includes("nsfw"));
  });
  const drawn = waiting().map((p) => {
    const caption = () => [credit(p), tagChips(p.tags), h("p", {}, p.note), p.rows ? "" : messageBox(p.plate, p.settings.message, true, p.tags)];
    return plate(p.plate, p.title, () => swatch(p, 24), () => swatch(p, 40), caption);
  });

  root.append(
    h("div.gallery-wall", {}, ...real, ...drawn),
    h("p.note", {}, "Every piece here was knitted from a pattern made in ", h("a", { href: "./lab.html" }, "the lab"), ". Open a plate to see it larger, try decoding it, or just reveal what it says."),
    h("p.hint", {}, "About the tags: they describe the message, not the knitting. Until it is decoded, even the rudest piece here is a perfectly respectable bit of purl."),
    dialog,
  );
  // gallery.html#plate-03 opens that plate.
  const linked = /^#plate-\d+$/.test(location.hash) ? document.querySelector<HTMLButtonElement>(`${location.hash} .plate-frame`) : null;
  linked?.click();
}
