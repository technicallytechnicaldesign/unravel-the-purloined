// Settings controls shared by the encoder and the decoder: transform, error
// checks, layout, carrier, construction and secure mode. Each returns its element and a
// getter, so the two tools read settings the same way.

import { h } from "./h";
import { type EncodingSettings, type GlyphSettings } from "../engine/project";
import { type Alphabet } from "../engine/alphabet";
import { type SymbolCode } from "../engine/errorcontrol";
import { type Construction } from "../engine/construction";
import { type CarrierId } from "../engine/carrier";
import { UNITS, type UnitId } from "../engine/units";
import { type GlyphPack } from "../engine/glyphs";
import { SECURE_LABEL } from "../engine/secure";
import { CIPHERS, keyProblem, PUZZLE_LABEL, type CipherKind, type CipherSettings } from "../engine/ciphers";

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
    ["glyph-pixel5", "Motif alphabet: pixel letters (5 × 5)"],
    ["glyph-geometric3", "Motif alphabet: geometric symbols (3 × 3)"],
    ["glyph-geometric4", "Motif alphabet: geometric symbols that repair a slip (4 × 4)"],
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

  // An alphabet designed in the lab, offered as one more transform once there is one.
  let custom: Alphabet | undefined;
  const setCustom = (a: Alphabet | undefined, choose = true) => {
    custom = a;
    transform.querySelector('option[value="glyph-custom"]')?.remove();
    if (a) transform.append(h("option", { value: "glyph-custom" }, `Your alphabet: ${a.name} (${a.width} × ${a.height})`));
    if (a && choose) transform.value = "glyph-custom";
    if (!a && !transform.value) transform.value = "fivebit";
    sync();
  };
  const sync = () => {
    checks.hidden = transform.value !== "fivebit";
    note.textContent = transform.value === "glyph-custom"
      ? "Your own symbols, from the alphabet designer below. Characters without a symbol are left out and listed."
      : transform.value === "glyph-pixel5"
      ? "The letters themselves, knitted as small pictures. Anyone can read them; they carry A to Z, 0 to 9, space, full stop and question mark."
      : transform.value === "glyph-geometric3"
        ? "A secret alphabet designed here: 38 symbols, each 3 stitches square. Any two differ by at least two stitches, so a single slip is noticed, but it may not be clear which symbol was meant."
        : transform.value === "glyph-geometric4"
        ? "A secret alphabet designed here: 38 symbols, each 4 stitches square. Any two differ by at least three stitches, however the fabric is turned, so one slipped stitch in a symbol is read as the right symbol and reported."
        : transform.value.startsWith("bacon")
      ? "Historical / puzzle cipher, not modern security. Bacon's alphabet has no space, so words run together."
      : transform.value === "morse"
        ? "Morse has no error checks of its own; gaps carry the letter breaks."
        : "";
  };
  for (const el of [transform, code, separator.input, checksum.input]) el.addEventListener("change", () => (sync(), onChange()));
  sync();

  const get = (): EncodingSettings => {
    const t = transform.value;
    if (t === "morse" || t.startsWith("glyph-")) return { alphabet: "morse" };
    if (t.startsWith("bacon-")) return { alphabet: "bacon", variant: t.slice(6) as "historical24" | "modern26" };
    return { alphabet: "fivebit", errorControl: { code: code.value as SymbolCode, separator: separator.input.checked, checksum: checksum.input.checked } };
  };
  /** The motif alphabet pack, when one is chosen. Letters are then normalized as for Morse. */
  const glyphs = (): GlyphSettings | undefined =>
    transform.value === "glyph-custom" && custom ? { alphabet: custom } : transform.value.startsWith("glyph-") ? { pack: transform.value.slice(6) as GlyphPack } : undefined;
  const set = (e: EncodingSettings, g?: GlyphSettings) => {
    if (g && "alphabet" in g) setCustom(g.alphabet);
    else transform.value = g ? `glyph-${g.pack}` : e.alphabet === "bacon" ? `bacon-${e.variant}` : e.alphabet;
    if (e.alphabet === "fivebit") {
      code.value = e.errorControl.code;
      separator.input.checked = e.errorControl.separator;
      checksum.input.checked = e.errorControl.checksum;
    }
    sync();
  };
  return { el: h("div.control-group", {}, field("TRANSFORM", transform), note, checks), get, set, glyphs, setCustom };
}

export function carrierControls(onChange: () => void, withColours: boolean) {
  const carrier = select("carrier", [
    ["purl-relief", "Purl relief (knit / purl)"],
    ["two-colour", "Two-colour (A / B)"],
    ["cable", "Cables (left or right cross)"],
    ["lace", "Lace (left or right lean)"],
    ["bobble", "Bobbles"],
    ["bead", "Beads"],
    ["stripes", "Stripes (Morse in row counts)"],
  ]);
  const note = h("p.hint", {});
  const a = h("input", { type: "text", name: "colour-a", value: "cream", maxlength: 20 });
  const b = h("input", { type: "text", name: "colour-b", value: "red", maxlength: 20 });
  const colours = h("div.pair", {}, field("COLOUR A", a), field("COLOUR B", b));
  const sync = () => {
    const id = carrier.value as CarrierId;
    colours.hidden = !withColours || (id !== "two-colour" && id !== "stripes");
    const u = id in UNITS ? UNITS[id as UnitId] : undefined;
    note.textContent = u
      ? withColours
        ? `Each cell of the grid becomes a block of ${u.width} stitches by ${u.height} rows, so the piece is ${u.width} times wider than the message width.`
        : `Mark one cell for each ${u.width} by ${u.height} block: 0 or 1, as the chart key says.`
      : id === "stripes"
        ? withColours
          ? "Morse only. Every row is one colour; the width is up to you."
          : "Mark each row by its colour, cast-on edge at the bottom: colour B is 1."
        : "";
  };
  for (const el of [carrier, a, b]) el.addEventListener(el === carrier ? "change" : "input", () => (sync(), onChange()));
  sync();
  return {
    el: h("div.control-group", {}, field("CARRIER", carrier), note, colours),
    get: () => ({ id: carrier.value as CarrierId, ...(carrier.value === "two-colour" || carrier.value === "stripes" ? { colours: { A: a.value || "A", B: b.value || "B" } } : {}) }),
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
    set: (c: Construction) => (el.value = c.method === "round" ? "round" : `flat-${c.firstRow}`),
  };
}

/** Optional classical cipher: kind, key, and what the key means. */
export function cipherControls(onChange: () => void) {
  const kind = select("cipher", Object.entries(CIPHERS).map(([k, v]) => [k, v.name] as [string, string]));
  const key = h("input", { type: "text", name: "cipher-key", maxlength: 40, autocomplete: "off", spellcheck: "false" });
  const keyField = field("KEY", key);
  const hint = h("p.hint", {});
  const problem = h("p.error.mono", { role: "status" });
  const sync = () => {
    const info = CIPHERS[kind.value as CipherKind];
    keyField.hidden = kind.value === "none";
    keyField.querySelector(".field-label")!.textContent = info.keyLabel;
    key.placeholder = info.example;
    hint.textContent = kind.value === "none" ? "" : `${info.keyHint} ${PUZZLE_LABEL}`;
    const p = kind.value === "none" ? null : keyProblem(get());
    problem.textContent = p ?? "";
  };
  const get = (): CipherSettings => ({ kind: kind.value as CipherKind, key: key.value.trim() || CIPHERS[kind.value as CipherKind].example });
  kind.addEventListener("change", () => (sync(), onChange()));
  key.addEventListener("input", () => (sync(), onChange()));
  sync();
  return {
    el: h("div.control-group", {}, field("CIPHER (OPTIONAL)", kind), keyField, hint, problem),
    /** The cipher, or undefined when none is chosen or the key is unusable. */
    get: (): CipherSettings | undefined => (kind.value === "none" || keyProblem(get()) ? undefined : get()),
    set: (c?: CipherSettings) => {
      kind.value = c?.kind ?? "none";
      key.value = c?.key ?? "";
      sync();
    },
  };
}

/** Secure mode: real encryption from a passphrase, kept apart from the historical ciphers. */
export function secureControls(onChange: () => void, hint: string) {
  const on = check("secure", "Encrypt with a passphrase (AES-GCM)", false);
  const pass = h("input", { type: "password", name: "passphrase", autocomplete: "off", spellcheck: "false", placeholder: "several words, easy to say, hard to guess" });
  const show = check("show-passphrase", "Show passphrase", false);
  const box = h("div", {}, field("PASSPHRASE", pass, "Longer is stronger. It is not saved anywhere, not even in project files."), show.el, h("p.hint", {}, SECURE_LABEL), h("p.hint", {}, hint));
  const sync = () => {
    box.hidden = !on.input.checked;
    pass.type = show.input.checked ? "text" : "password";
  };
  on.input.addEventListener("change", () => (sync(), onChange()));
  show.input.addEventListener("change", sync);
  pass.addEventListener("input", onChange);
  sync();
  return {
    el: h("fieldset.checks", {}, h("legend.mono", {}, "SECURE MODE (OPTIONAL)"), on.el, box),
    on: () => on.input.checked,
    passphrase: () => pass.value,
    set: (v: boolean) => ((on.input.checked = v), sync()),
  };
}
