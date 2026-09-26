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

/** Offer text, bytes or a blob as a file download. */
export function download(name: string, type: string, content: string | Uint8Array | Blob): void {
  const blob = content instanceof Blob ? content : new Blob([content as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Draw an SVG string onto a canvas at `scale` and return it as a PNG. */
export function svgToPng(svg: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not make a PNG."))), "image/png");
    };
    img.onerror = () => (URL.revokeObjectURL(url), reject(new Error("Could not draw the chart.")));
    img.src = url;
  });
}
