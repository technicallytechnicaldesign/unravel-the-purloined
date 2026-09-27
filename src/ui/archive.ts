// The archive: exhibit index, exhibit pages (packet section 35 template) and the
// source register. Draft exhibits are shown only with ?drafts in the address,
// so unchecked claims never reach the public page by accident.

import { h } from "./h";
import { EXHIBITS, GRADES, type Claim, type Exhibit } from "../content/exhibits";
import { SOURCES, sourceById } from "../content/sources";

const STATUS_TEXT = { unchecked: "NOT YET CHECKED", checked: "CHECKED", "needs-human": "NEEDS A LIBRARY OR A COPY" } as const;

function badge(grade: Claim["grade"], proposed: boolean): HTMLElement {
  return h(`span.badge.badge-${grade.toLowerCase()}`, { title: GRADES[grade].meaning }, `${grade} / ${GRADES[grade].badge}${proposed ? " (PROPOSED)" : ""}`);
}

function sourceLink(id: string): HTMLElement {
  const s = sourceById(id)!;
  // Scroll to the source on this page without changing the route.
  const scroll = (ev: Event) => (ev.preventDefault(), document.getElementById(`source-${id}`)?.scrollIntoView({ behavior: "smooth" }));
  return h("a.src.mono", { href: `#source-${id}`, title: `${s.publisher}: ${s.title}`, onclick: scroll }, `[${id}]`);
}

function exhibitView(e: Exhibit): HTMLElement {
  const draft = e.status === "draft";
  const cited = [...new Set(e.claims.flatMap((c) => c.sources))].sort();
  return h(
    "article.exhibit",
    {},
    h("p", {}, h("a.mono", { href: location.search ? `${location.search}#` : "#" }, "← All exhibits")),
    h("div.labels", {}, h("span.mono", {}, `${e.archive} / ${e.place.toUpperCase()} / ${e.period.toUpperCase()}`), draft ? h("span.stamp", {}, "DRAFT / SOURCES BEING CHECKED") : ""),
    h("h2.section-label.exhibit-title", {}, e.title),
    h("p.lede", {}, e.lede),
    draft ? h("p.note.mono", {}, "Written from the project's research brief. Grades are proposals until each source has been read and recorded.") : "",
    h("h3.step-title", {}, "Claims"),
    h(
      "ol.claims",
      {},
      ...e.claims.map((c) =>
        h(
          "li.claim",
          {},
          badge(c.grade, draft),
          h("p", {}, c.text, " ", ...c.sources.map(sourceLink)),
          c.sourceNote ? h("p.hint", {}, `No source yet: ${c.sourceNote}`) : "",
          h("details.more", {}, h("summary.mono", {}, "WHY THIS LABEL?"), h("p", {}, c.why), h("p.hint", {}, `${GRADES[c.grade].badge}: ${GRADES[c.grade].meaning}`)),
        ),
      ),
    ),
    h("div.know", {}, h("section", {}, h("h3.step-title", {}, "What we know"), h("ul", {}, ...e.know.map((k) => h("li", {}, k)))), h("section", {}, h("h3.step-title", {}, "What we do not know"), h("ul", {}, ...e.unknown.map((k) => h("li", {}, k))))),
    e.experiment ? h("p.experiment", {}, h("span.badge.badge-x", {}, "RELATED EXPERIMENT"), " ", h("a", { href: e.experiment.href }, e.experiment.text)) : "",
    h("h3.step-title", {}, "Sources"),
    h("ul.source-list", {}, ...cited.map((id) => sourceItem(id))),
  );
}

function sourceItem(id: string): HTMLElement {
  const s = sourceById(id)!;
  return h(
    "li",
    { id: `source-${id}` },
    h("span.mono", {}, `[${s.id}] `),
    `${s.publisher}, `,
    h("a", { href: s.url, rel: "noopener" }, s.title),
    " ",
    h(`span.badge${s.status === "checked" ? ".badge-a" : ".badge-c"}`, {}, STATUS_TEXT[s.status]),
    s.status === "checked" && s.supports.length ? h("p.hint", {}, `Supports: ${s.supports.join("; ")}`) : "",
  );
}

function indexView(showDrafts: boolean): HTMLElement {
  const visible = EXHIBITS.filter((e) => showDrafts || e.status === "published");
  const coming = EXHIBITS.filter((e) => !showDrafts && e.status !== "published");
  return h(
    "div",
    {},
    h("p.note", {}, "Each exhibit shows its claims with an evidence grade, what we know, what we do not know yet, and the sources behind it."),
    h(
      "div.grades",
      {},
      ...Object.entries(GRADES).map(([g, v]) => h("p", {}, h(`span.badge.badge-${g.toLowerCase()}`, {}, `${g} / ${v.badge}`), " ", h("span.hint", {}, v.meaning))),
    ),
    visible.length
      ? h(
          "ol.cases",
          {},
          ...visible.map((e) =>
            h(
              "li.case-card",
              {},
              h("p.mono.case-n", {}, e.archive, e.status === "draft" ? h("span.stamp.stamp-small", {}, "DRAFT") : ""),
              h("h3.step-title", {}, e.title),
              h("p.hint", {}, `${e.place}, ${e.period}`),
              h("p", {}, e.lede),
              h("a.btn", { href: `${location.search}#${e.slug}` }, "Open the exhibit →"),
            ),
          ),
        )
      : "",
    coming.length
      ? h(
          "section",
          {},
          h("h2.step-title", {}, "In preparation"),
          h("p.hint", {}, "These open once every source they cite has been read and recorded."),
          h("ul.coming", {}, ...coming.map((e) => h("li", {}, h("span.mono", {}, `${e.archive} `), e.title, h("span.hint", {}, ` (${e.place})`)))),
        )
      : "",
    h("p", {}, h("a.btn", { href: `${location.search}#sources` }, "The source register →")),
  );
}

function registerView(): HTMLElement {
  const checked = SOURCES.filter((s) => s.status === "checked").length;
  return h(
    "div",
    {},
    h("p", {}, h("a.mono", { href: `${location.search}#` }, "← All exhibits")),
    h("h2.section-label", {}, "Source register"),
    h("p.note", {}, `${checked} of ${SOURCES.length} sources read and recorded so far. Each is checked for what the page actually says before any exhibit relies on it.`),
    h("ul.source-list", {}, ...SOURCES.map((s) => sourceItem(s.id))),
  );
}

export function mountArchive(root: HTMLElement): void {
  const showDrafts = new URLSearchParams(location.search).has("drafts") || import.meta.env.DEV;
  const route = () => {
    const slug = location.hash.slice(1);
    const exhibit = EXHIBITS.find((e) => e.slug === slug && (showDrafts || e.status === "published"));
    if (slug === "sources" || slug.startsWith("source-")) {
      root.replaceChildren(registerView());
      if (slug.startsWith("source-")) document.getElementById(slug)?.scrollIntoView();
    } else if (exhibit) root.replaceChildren(exhibitView(exhibit));
    else root.replaceChildren(indexView(showDrafts));
    document.title = exhibit ? `${exhibit.title}: the archive` : "The archive: Unravel the Purloined";
  };
  window.addEventListener("hashchange", route);
  route();
}
