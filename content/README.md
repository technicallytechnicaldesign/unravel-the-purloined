# Writing exhibits

Each exhibit in the archive is one Markdown file in `content/exhibits/`. Copy `_template.md`, rename it (the name does not matter, the `slug` does), and write. Files starting with `_` are ignored.

`npm test` checks every file. If something is off it names the file and line, for example `content/exhibits/norway.md, line 14: every claim needs a "Why:" line explaining its grade.` Preview with `npm run dev` and open `/archive.html?drafts`.

## The header

```
---
slug: norway                 the address: archive.html#norway
archive: ARCHIVE 04.1        the archive number, also sets the order
title: The red cap
place: Norway
period: German occupation
status: draft                draft or published
experiment: Try the two-colour carrier in the lab. | ./lab.html
---
```

`experiment` is optional: link text, a `|`, then the address.

## The body

A short opening paragraph (the lede), then three sections.

```
## Claims

- [B] [S01] The red knitted topplue became a symbol of Norwegian identity and resistance.
  Why: A national encyclopedia entry, written from the historical record.

- [D] A particular knitter recorded trains stitch by stitch.
  Why: Widely retold, but no page-level source.
  Missing: What would settle it, and where to look.

## What we know

- One plain sentence per point.

## What we do not know

- One plain sentence per point.
```

A claim line is: `- [grade]`, then its sources as `[S01] [S02]`, then the claim. Indent following lines by two spaces. Every claim needs a `Why:` line.

## Grades

| Grade | Badge | Use for |
|---|---|---|
| A | Documented | A surviving object, regulation, contemporary text, archive document or direct testimony. |
| B | Strong reconstruction | Archival scholarship or several reliable sources. |
| C | Later account | Later accounts and oral history: valuable, harder to check. |
| D | Disputed | Historians disagree or the documentation is weak. |
| X | Modern reconstruction | Systems built here, today, from a historical principle. |

## Rules the tests enforce

- Every claim has a grade and a `Why:`.
- Every source id exists in `src/content/sources.json`.
- A claim with no source is only allowed as grade D, with a `Missing:` line.
- `status: published` is only allowed when every source the page cites has status `checked` in the register.
- No em dashes, no "unbreakable", no "traditional".

## House style

Plain, warm, grounded. Short sentences. Do not merge separate facts into a stronger claim: say what each source supports and stop there.
