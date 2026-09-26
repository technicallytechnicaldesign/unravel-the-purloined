// A clickable grid of cells, shared by the lab decoder and the game. One tab
// stop; arrow keys move, space or enter switches a cell, Home and End jump
// along the row. Row 0 is drawn at the bottom, as in a chart.

import { h } from "./h";
import { type Bit } from "../engine/fivebit";
import { type Cell } from "../engine/grid";

export interface CellGrid {
  el: HTMLElement;
  get(): Bit[][];
  set(cells: Bit[][]): void;
  setColour(colour: boolean): void;
  mark(cells: readonly Cell[], cls: string): void;
  unmark(cls: string): void;
}

export function cellGrid(opts: { cells: Bit[][]; label: string; colour?: boolean; onChange: (cells: Bit[][]) => void }): CellGrid {
  let cells = opts.cells;
  let colour = opts.colour ?? false;
  let active: Cell = [cells.length - 1, 0];
  const el = h("div.dgrid", { role: "group", "aria-label": `${opts.label}. Arrow keys move, space or enter switches a cell, Home and End jump along the row.` });
  const button = ([r, c]: Cell) => el.querySelector<HTMLButtonElement>(`[data-cell="${r},${c}"]`);

  el.addEventListener("keydown", (ev) => {
    const [r, c] = active;
    const w = cells[0]!.length;
    const next: Record<string, Cell> = {
      ArrowUp: [Math.min(r + 1, cells.length - 1), c],
      ArrowDown: [Math.max(r - 1, 0), c],
      ArrowLeft: [r, Math.max(c - 1, 0)],
      ArrowRight: [r, Math.min(c + 1, w - 1)],
      Home: [r, 0],
      End: [r, w - 1],
    };
    const to = next[ev.key];
    if (!to) return;
    ev.preventDefault();
    button(active)?.setAttribute("tabindex", "-1");
    active = to;
    button(active)?.setAttribute("tabindex", "0");
    button(active)?.focus();
  });

  const draw = () => {
    const w = cells[0]!.length;
    el.classList.toggle("colour", colour);
    el.style.setProperty("--cols", String(w + 1));
    const hadFocus = el.contains(document.activeElement);
    active = [Math.min(active[0], cells.length - 1), Math.min(active[1], w - 1)];
    el.replaceChildren();
    for (let r = cells.length - 1; r >= 0; r--) {
      cells[r]!.forEach((b, c) => {
        const state = colour ? (b ? "colour B" : "colour A") : b ? "purl" : "knit";
        el.append(
          h(`button.dcell.b${b}`, {
            type: "button",
            "data-cell": `${r},${c}`,
            "aria-label": `Row ${r + 1}, stitch ${w - c}: ${state}`,
            tabindex: r === active[0] && c === active[1] ? 0 : -1,
            onfocus: () => (active = [r, c]),
            onclick: () => {
              cells[r]![c] = (1 - cells[r]![c]!) as Bit;
              draw();
              opts.onChange(cells);
            },
          }),
        );
      });
      el.append(h("span.rownum.mono", { "aria-hidden": "true" }, r + 1));
    }
    if (hadFocus) button(active)?.focus();
  };

  draw();
  return {
    el,
    get: () => cells,
    set: (next) => {
      cells = next;
      draw();
      opts.onChange(cells);
    },
    setColour: (c) => {
      colour = c;
      draw();
    },
    mark: (list, cls) => list.forEach((c) => button(c)?.classList.add(cls)),
    unmark: (cls) => el.querySelectorAll(`.${cls}`).forEach((b) => b.classList.remove(cls)),
  };
}
