// The knitted wordmark: "UNRAVEL THE PURLOINED" in the five-bit alphabet, one
// column of five stitches per letter, a dot for purl (1), the letter beneath.
// Built over a heading or link whose own text stays as the accessible name.

import { h } from "./h";
import { BITS_PER_SYMBOL, encode } from "../engine/fivebit";

export const TITLE = "UNRAVEL THE PURLOINED";

/** Draw the wordmark inside `host`, keeping its text for screen readers. */
export function mountWordmark(host: HTMLElement, text = TITLE): void {
  const bits = encode(text);
  const chart = h("span.wordmark", { "aria-hidden": "true" });
  chart.style.setProperty("--cols", String(text.length));
  [...text].forEach((ch, i) => {
    const col = h(`span.wm-col${ch === " " ? ".wm-space" : ""}`);
    col.style.setProperty("--delay", `${i * 85}ms`);
    for (const b of bits.slice(i * BITS_PER_SYMBOL, (i + 1) * BITS_PER_SYMBOL)) col.append(h(`i.wm-cell${b ? ".purl" : ""}`));
    col.append(h("b.wm-letter", {}, ch === " " ? "˽" : ch));
    chart.append(col);
  });
  const name = h("span.visually-hidden", {}, host.textContent?.trim() || text);
  host.replaceChildren(name, chart);
  host.classList.add("has-wordmark");
}

/** Every element marked data-wordmark on the page, spelling its data-wordmark value (the site title when empty). */
export const mountWordmarks = (): void => document.querySelectorAll<HTMLElement>("[data-wordmark]").forEach((el) => mountWordmark(el, el.dataset.wordmark || TITLE));
