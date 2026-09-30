// The gallery wall: plates in knitted frames. A plate opens a larger view with
// the credit, content tags, and the message hidden until asked for; "try
// decoding it" opens the piece's pattern in the decoder with a blank grid.

import { h } from "./h";
import { createProject } from "../engine/project";
import { fabricSvg } from "../engine/fabric";
import { type Visible } from "../engine/construction";
import { PIECES, TAGS, waiting, type Piece, type Placeholder } from "../content/gallery";

/** A tile of seed stitch in red yarn, for the knitted frames. Drawn without wobble so it repeats cleanly. */
function frameTile(): string {
  const K: Visible = "knit", P: Visible = "purl";
  const chart = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => ((r + c) % 2 ? P : K)));
  const w = 12, pad = w * 0.8;
  const svg = fabricSvg(chart, { seed: 3, stitch: w, wobble: 0, colours: { A: "#c8201e", B: "#c8201e" } }).replace(/viewBox="[^"]*"/, `viewBox="${pad} ${pad} ${4 * w} ${4 * w * 0.78}"`).replace(/ width="[^"]*" height="[^"]*"/, ` width="${4 * w}" height="${4 * w * 0.78}"`);
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

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
function messageBox(plate: string, message: string | undefined, canDecode: boolean): HTMLElement | "" {
  if (!message && !canDecode) return "";
  const shown = h("p.mono.big.reveal-text", { hidden: true, "aria-live": "polite" }, message ?? "");
  const reveal = h("button.btn", { type: "button" }, "Reveal the message");
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
  document.documentElement.style.setProperty("--frame-knit", frameTile());
  const dialog = h("dialog.lightbox", { "aria-label": "Plate" }) as HTMLDialogElement;
  dialog.addEventListener("click", (ev) => ev.target === dialog && dialog.close()); // click outside closes
  const open = (big: () => HTMLElement, caption: () => (Node | string)[], title: string) => {
    dialog.setAttribute("aria-label", title);
    dialog.replaceChildren(
      h("button.lightbox-close", { type: "button", "aria-label": "Close", onclick: () => dialog.close() }, "×"),
      h("div.lightbox-body", {}, h("div.knit-frame.lightbox-frame", {}, h("div.mat", {}, big())), h("div.lightbox-caption", {}, h("h2.plate-title", {}, title), ...caption())),
    );
    dialog.showModal();
  };

  // Captions are built fresh for the card and for each opening: a node can only sit in one place.
  const plate = (id: string, title: string, thumb: () => HTMLElement, big: () => HTMLElement, caption: () => (Node | string)[], nsfw = false) => {
    const frame = h("button.knit-frame.plate-frame", { type: "button", "aria-label": `Open plate ${id}: ${title}`, onclick: () => open(big, caption, `Plate ${id}: ${title}`) }, h("div.mat", {}, thumb(), nsfw ? h("span.nsfw-cover.mono", {}, "NSFW / OPEN TO VIEW") : ""));
    return h("figure.plate", { id: `plate-${id}` }, frame, h("figcaption", {}, h("p.mono.plate-no", {}, `PLATE ${id}`), h("h2.plate-title", {}, title), ...caption().slice(0, 2)));
  };

  const real = PIECES.map((p) => {
    const img = (cls: string) => h(`img.${cls}`, { src: `${import.meta.env.BASE_URL}${p.image}`, alt: p.alt, loading: "lazy" });
    const caption = () => [credit(p), tagChips(p.tags), h("p.hint", {}, p.made), p.notes ? h("p", {}, p.notes) : "", messageBox(p.plate, p.message, !!p.pattern)];
    return plate(p.plate, p.title, () => img("plate-img" + (p.tags?.includes("nsfw") ? ".blurred" : "")), () => img("lightbox-img"), caption, p.tags?.includes("nsfw"));
  });
  const drawn = waiting().map((p) => {
    const caption = () => [credit(p), tagChips(p.tags), h("p", {}, p.note), p.rows ? "" : messageBox(p.plate, p.settings.message, true)];
    return plate(p.plate, p.title, () => swatch(p, 24), () => swatch(p, 40), caption);
  });

  root.append(
    h("div.gallery-wall", {}, ...real, ...drawn),
    h("p.note", {}, "Every piece here was knitted from a pattern made in ", h("a", { href: "./lab.html" }, "the lab"), ". Open a plate to see it larger, try decoding it, or just reveal what it says."),
    dialog,
  );
  // gallery.html#plate-03 opens that plate.
  const linked = /^#plate-\d+$/.test(location.hash) ? document.querySelector<HTMLButtonElement>(`${location.hash} .plate-frame`) : null;
  linked?.click();
}
