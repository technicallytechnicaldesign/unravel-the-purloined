import "./style.css";
import { BITS_PER_SYMBOL, encode, normalize } from "./engine/fivebit";

const input = document.querySelector<HTMLInputElement>("#msg")!;
const chart = document.querySelector<HTMLDivElement>("#chart")!;
const dropped = document.querySelector<HTMLParagraphElement>("#dropped")!;
const count = document.querySelector<HTMLSpanElement>("#count")!;

function render(): void {
  const n = normalize(input.value);
  const bits = encode(n.text);
  chart.replaceChildren();

  Array.from(n.text).forEach((ch, i) => {
    const col = document.createElement("div");
    col.className = "col" + (ch === " " ? " col-space" : "");
    const symbol = bits.slice(i * BITS_PER_SYMBOL, (i + 1) * BITS_PER_SYMBOL);
    for (const b of symbol) {
      const cell = document.createElement("i");
      cell.className = "cell " + (b ? "purl" : "knit");
      col.append(cell);
    }
    const label = document.createElement("span");
    label.className = "col-label mono";
    label.textContent = ch === " " ? "␣" : ch;
    col.title = `${ch === " " ? "space" : ch} = ${symbol.join("")}`;
    col.append(label);
    chart.append(col);
  });

  const lost = [...new Set(n.dropped.map((d) => d.char))];
  dropped.hidden = lost.length === 0;
  dropped.textContent = lost.length ? `Not in the alphabet, left out: ${lost.join(" ")}` : "";
  count.textContent = `${n.text.length} letters, ${bits.length} stitches`;
}

input.addEventListener("input", render);
render();
