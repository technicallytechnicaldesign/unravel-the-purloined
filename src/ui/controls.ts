// Settings controls shared by the encoder and the decoder: transform, error
// checks, layout, carrier and construction. Each returns its element and a
// getter, so the two tools read settings the same way.

import { h } from "./h";
import { type EncodingSettings } from "../engine/project";
import { type SymbolCode } from "../engine/errorcontrol";
import { type Construction } from "../engine/construction";
import { type CarrierId } from "../engine/carrier";

export function field(label: string, control: HTMLElement, hint?: string): HTMLLabelElement {
  return h("label.field", {}, h("span.mono.field-label", {}, label), control, hint ? h("span.hint", {}, hint) : null);
}

export function select(name: string, options: [value: string, label: string][], value?: string): HTMLSelectElement {
  const el = h("select", { name });
  for (const [v, l] of options) el.append(h("option", { value: v, selected: v === value }, l));
  return el;
}

export function check(name: string, label: string, checked: boolean): { el: HTMLLabelElement; input: HTMLInputElement } {
  const input = h("input", { type: "checkbox", name, checked });
  return { el: h("label.check.mono", {}, input, " ", label), input };
}

export function encodingControls(onChange: () => void) {
  const transform = select("transform", [
    ["fivebit", "Five-bit alphabet"],
    ["morse", "Morse code"],
    ["bacon-historical24", "Bacon, historical 24-letter"],
    ["bacon-modern26", "Bacon, modern 26-letter"],
  ]);
  const code = select("code", [
    ["parity", "Parity cell per letter"],
    ["hamming", "Hamming: repairs one cell per letter"],
    ["plain", "None"],
  ]);
  const separator = check("separator", "Separator cell after each letter", true);
  const checksum = check("checksum", "Checksum at the end", true);
  const checks = h("fieldset.checks", {}, h("legend.mono", {}, "ERROR CHECKS"), field("PER LETTER", code), separator.el, checksum.el);
  const note = h("p.hint", {});

  const sync = () => {
    checks.hidden = transform.value !== "fivebit";
    note.textContent = transform.value.startsWith("bacon")
      ? "Historical / puzzle cipher, not modern security. Bacon's alphabet has no space, so words run together."
      : transform.value === "morse"
        ? "Morse has no error checks of its own; gaps carry the letter breaks."
        : "";
  };
  for (const el of [transform, code, separator.input, checksum.input]) el.addEventListener("change", () => (sync(), onChange()));
  sync();

  const get = (): EncodingSettings => {
    const t = transform.value;
    if (t === "morse") return { alphabet: "morse" };
    if (t.startsWith("bacon-")) return { alphabet: "bacon", variant: t.slice(6) as "historical24" | "modern26" };
    return { alphabet: "fivebit", errorControl: { code: code.value as SymbolCode, separator: separator.input.checked, checksum: checksum.input.checked } };
  };
  const set = (e: EncodingSettings) => {
    transform.value = e.alphabet === "bacon" ? `bacon-${e.variant}` : e.alphabet;
    if (e.alphabet === "fivebit") {
      code.value = e.errorControl.code;
      separator.input.checked = e.errorControl.separator;
      checksum.input.checked = e.errorControl.checksum;
    }
    sync();
  };
  return { el: h("div.control-group", {}, field("TRANSFORM", transform), note, checks), get, set };
}

export function carrierControls(onChange: () => void, withColours: boolean) {
  const carrier = select("carrier", [
    ["purl-relief", "Purl relief (knit / purl)"],
    ["two-colour", "Two-colour (A / B)"],
  ]);
  const a = h("input", { type: "text", name: "colour-a", value: "cream", maxlength: 20 });
  const b = h("input", { type: "text", name: "colour-b", value: "red", maxlength: 20 });
  const colours = h("div.pair", {}, field("COLOUR A", a), field("COLOUR B", b));
  const sync = () => (colours.hidden = !withColours || carrier.value !== "two-colour");
  for (const el of [carrier, a, b]) el.addEventListener(el === carrier ? "change" : "input", () => (sync(), onChange()));
  sync();
  return {
    el: h("div.control-group", {}, field("CARRIER", carrier), colours),
    get: () => ({ id: carrier.value as CarrierId, ...(carrier.value === "two-colour" ? { colours: { A: a.value || "A", B: b.value || "B" } } : {}) }),
    set: (id: CarrierId) => ((carrier.value = id), sync()),
  };
}

export function constructionControl(onChange: () => void) {
  const el = select("construction", [
    ["flat-RS", "Flat, row 1 on the right side"],
    ["flat-WS", "Flat, row 1 on the wrong side"],
    ["round", "In the round"],
  ]);
  el.addEventListener("change", onChange);
  return {
    el: field("CONSTRUCTION", el),
    get: (): Construction => (el.value === "round" ? { method: "round", firstRow: "RS" } : { method: "flat", firstRow: el.value === "flat-WS" ? "WS" : "RS" }),
  };
}
