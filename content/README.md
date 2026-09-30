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

# Hanging a piece in the gallery

Put the photo in `public/gallery/` (JPEG or WebP, around 1200 px on the long side). If visitors should be able to decode it themselves, save the lab's project file (PROJECT JSON) next to it. Then add an entry to `src/content/gallery.json`:

```json
[
  {
    "plate": "01",
    "title": "Red scarf",
    "date": "2026-10",
    "knitter": "Sam",
    "handle": "@woolly",
    "image": "gallery/red-scarf.jpg",
    "alt": "A red scarf laid flat, with rows of purl bumps across one end.",
    "made": "Five-bit, purl relief, DK wool.",
    "pattern": "gallery/red-scarf.json",
    "message": "MEET AT NOON",
    "tags": ["kid-friendly"],
    "notes": "Optional words about the piece."
  }
]
```

- `knitter`, `handle`, `pattern`, `message`, `tags` and `notes` are optional. The credit line (KNITTED BY SAM / @woolly / 2026-10) takes the place of the X badge that drawings carry.
- The message starts hidden. "Try decoding it" opens the decoder in a new tab with the pattern's settings and an empty grid (`decode.html#plate=01`); "Reveal the message" just shows it. It is a puzzle, not a secret: anyone can read it in the page source.
- Tags describe the message once decoded, not the knitting: `kid-friendly`, `swearing` ("Message contains swearing"), `nsfw` ("Message is NSFW"). Any other word shows as a plain tag. Pictures are never blurred (the stitches are only stitches); an NSFW piece gets a "NSFW ONCE DECODED" stamp and its reveal button says so.
- `alt` describes the picture, never the message.
- Each real piece takes the place of one drawn frame; one always stays empty.
