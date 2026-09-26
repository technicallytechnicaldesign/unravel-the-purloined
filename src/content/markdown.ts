// Exhibit files: plain Markdown with a small header, so exhibits can be written
// without touching code. See content/README.md for the format. Mistakes come
// back as errors naming the file and line, never as a silently odd page.

import { GRADES, type Claim, type Exhibit, type Grade } from "./types";

export class ExhibitError extends Error {}

const REQUIRED = ["slug", "archive", "title", "place", "period", "status"] as const;

export function parseExhibit(md: string, file: string): Exhibit {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const fail = (line: number, msg: string): never => {
    throw new ExhibitError(`${file}, line ${line + 1}: ${msg}`);
  };

  // Header between two --- lines.
  if (lines[0]?.trim() !== "---") fail(0, 'the file must start with a "---" line opening the header.');
  const end = lines.indexOf("---", 1);
  if (end < 0) fail(0, 'the header is never closed with a "---" line.');
  const head: Record<string, string> = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const m = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!m) fail(i, `"${line}" is not a "key: value" header line.`);
    head[m![1]!] = m![2]!.trim();
  }
  for (const k of REQUIRED) if (!head[k]) fail(0, `the header needs "${k}:".`);
  if (head.status !== "draft" && head.status !== "published") fail(0, 'status must be "draft" or "published".');

  // Body: lede paragraphs, then ## sections.
  const sections = new Map<string, { start: number; lines: string[] }>();
  const lede: string[] = [];
  let current: string[] = lede;
  for (let i = end + 1; i < lines.length; i++) {
    const line = lines[i]!;
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      const name = h[1]!.trim().toLowerCase();
      if (!["claims", "what we know", "what we do not know"].includes(name)) fail(i, `unknown section "## ${h[1]}". Use Claims, What we know, What we do not know.`);
      current = [];
      sections.set(name, { start: i + 1, lines: current });
    } else current.push(line);
  }

  // List items: "- " starts one, indented lines continue it.
  const items = (name: string): { line: number; text: string[] }[] => {
    const s = sections.get(name);
    if (!s) return [];
    const out: { line: number; text: string[] }[] = [];
    s.lines.forEach((line, k) => {
      if (/^-\s+/.test(line)) out.push({ line: s.start + k, text: [line.replace(/^-\s+/, "")] });
      else if (/^\s+\S/.test(line) && out.length) out.at(-1)!.text.push(line.trim());
      else if (line.trim()) fail(s.start + k, `"${line.trim()}" should be a list item starting with "- ".`);
    });
    return out;
  };

  const claims: Claim[] = items("claims").map(({ line, text }) => {
    const first = /^\[([A-Z])\]\s*((?:\[S\d\d\]\s*)*)(.*)$/.exec(text[0]!);
    if (!first) fail(line, 'a claim starts with its grade in brackets, like "- [B] [S01] The claim."');
    const grade = first![1] as Grade;
    if (!(grade in GRADES)) fail(line, `"${grade}" is not a grade. Use A, B, C, D or X.`);
    const sources = [...first![2]!.matchAll(/S\d\d/g)].map((m) => m[0]);
    const body = [first![3]!.trim()];
    let why = "";
    let missing = "";
    for (const t of text.slice(1)) {
      if (/^why:/i.test(t)) why = t.replace(/^why:\s*/i, "");
      else if (/^missing:/i.test(t)) missing = t.replace(/^missing:\s*/i, "");
      else if (why) why += ` ${t}`;
      else if (missing) missing += ` ${t}`;
      else body.push(t);
    }
    if (!why) fail(line, 'every claim needs a "Why:" line explaining its grade.');
    return { text: body.join(" "), grade, sources, why, ...(missing ? { sourceNote: missing } : {}) };
  });
  if (!claims.length) fail(end, 'an exhibit needs a "## Claims" section with at least one claim.');

  const list = (name: string) => items(name).map((i) => i.text.join(" "));
  const [expText, expHref] = (head.experiment ?? "").split("|").map((s) => s.trim());

  return {
    slug: head.slug!,
    archive: head.archive!,
    title: head.title!,
    place: head.place!,
    period: head.period!,
    lede: lede.join("\n").trim().replace(/\s*\n\s*/g, " "),
    claims,
    know: list("what we know"),
    unknown: list("what we do not know"),
    ...(expText && expHref ? { experiment: { text: expText, href: expHref } } : {}),
    status: head.status as Exhibit["status"],
  };
}

/** The same exhibit written back as Markdown, in the documented format. */
export function writeExhibit(e: Exhibit): string {
  const head = [
    "---",
    `slug: ${e.slug}`,
    `archive: ${e.archive}`,
    `title: ${e.title}`,
    `place: ${e.place}`,
    `period: ${e.period}`,
    `status: ${e.status}`,
    ...(e.experiment ? [`experiment: ${e.experiment.text} | ${e.experiment.href}`] : []),
    "---",
  ];
  const claims = e.claims.flatMap((c) => [
    `- [${c.grade}]${c.sources.map((s) => ` [${s}]`).join("")} ${c.text}`,
    `  Why: ${c.why}`,
    ...(c.sourceNote ? [`  Missing: ${c.sourceNote}`] : []),
    "",
  ]);
  return [...head, "", e.lede, "", "## Claims", "", ...claims, "## What we know", "", ...e.know.map((k) => `- ${k}`), "", "## What we do not know", "", ...e.unknown.map((k) => `- ${k}`), ""].join("\n");
}
