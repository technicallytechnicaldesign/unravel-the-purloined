// Tiny element builder: h("p.note", { title: "x" }, "text", child).

type Child = Node | string | number | false | null | undefined;
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

type TagOf<S extends string> = S extends `${infer T}.${string}` ? T : S;
type ElementOf<S extends string> = TagOf<S> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagOf<S>] : HTMLElement;

export function h<S extends string>(tag: S, attrs: Attrs = {}, ...children: Child[]): ElementOf<S> {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name!) as ElementOf<S>;
  if (classes.length) el.className = classes.join(" ");
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === "function") el.addEventListener(k.replace(/^on/, ""), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== false && c !== null && c !== undefined) el.append(typeof c === "number" ? String(c) : c);
  return el;
}

/** Offer text as a file download. */
export function download(name: string, type: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
