# Unravel the Purloined: contributor brief

Read this first. It is self-contained on purpose.

## What this is

A website with two halves that link to each other:

- **A museum** of textiles as communication: craft as resistance, testimony, boycott, symbol, and covert carrier. Every historical claim shows its evidence grade.
- **A lab** that turns a message into a knittable pattern (chart plus written row instructions) and decodes a knitted grid back into text, showing every intermediate step.

The name joins Poe's *The Purloined Letter* (a message hidden in plain sight) with unravelling (decoding, and frogging a knit).

The full brief is `docs/research/research-packet-v0.2.txt`. Section numbers below refer to it.

## Source of truth

| File | Holds |
|---|---|
| `docs/research/research-packet-v0.2.txt` | The research packet: history, taxonomy, cipher families, architecture, roadmap, sources S01 to S23. |
| `docs/ROADMAP.md` | The task list for agents, each task with acceptance criteria. Tick tasks here when done. |
| `docs/LOG.md` | One dated line per session saying what changed. Append, never rewrite. |

## Architecture rules (packet sections 31, 32, 40)

1. **Keep data and textile separate until late.** Pipeline: normalize, optional cipher, symbol encoder, error control, logical grid, carrier, construction translator, output. Each stage is its own module under `src/engine/` with pure functions and no DOM access.
2. **Logical symbol, then craft carrier state.** Never hard-code "bit = knit stitch". A carrier maps logical states to visible fabric states; knitting is the first carrier, not the only one.
3. **A chart cell means the visible right-side result, not the needle action.** The construction translator converts outcome to action for flat (RS/WS rows alternate direction, WS stitches invert) and in-the-round knitting.
4. **Every encoder ships with its decoder** and a round-trip test: `decode(encode(x))` returns `x` for everything the encoder accepts.
5. **Report, do not hide.** Characters that cannot be carried, parity failures and framing slips come back as structured reports ("possible error near character 14"), never silent drops or a bare "INVALID".
6. **The project object is serializable** (packet section 37) so any generated pattern can be exported as JSON and re-imported.

## Honesty rules (packet sections 03, 23, 35)

- Evidence grades: `A` primary/object, `B` strong reconstruction, `C` later account/oral history, `D` disputed/insufficient, `X` modern reconstruction built here. No history page ships a claim without a grade and a source.
- Do not merge separate facts into a stronger claim. Example: Agnes Klønig smuggled messages and made clandestine needlework; there is no evidence yet that her messages were in stitches.
- Classical ciphers are labelled **historical / puzzle cipher, not modern security**.
- Any "secure" mode uses the browser's Web Crypto API with established authenticated encryption (for example AES-GCM with a PBKDF2 or similar derived key, random salt and nonce). Never invent a cipher for security. Never write "unbreakable".
- Do not call invented motifs "traditional". Do not present khipu as an ancestor of European coded knitting. Do not label arbitrary raised dots as Braille.

## Stack

- TypeScript (strict), Vite, Vitest. No framework unless a task needs one; ask in the PR first.
- Everything runs in the browser. No accounts, no server, no tracking.
- `npm test` must pass and `npm run build` must succeed before any merge.
- The site deploys to GitHub Pages from `main` via `.github/workflows/pages.yml`: https://technicallytechnicaldesign.github.io/unravel-the-purloined/

## Visual language (packet section 34)

Museum archive plus field manual plus knitting chart plus punch card. Paper, black, one strong red. Archivo (condensed widths for display), IBM Plex Mono for code, evidence and charts. Tokens live at the top of `src/style.css` with a dark mode; reuse them, do not add new colours casually. Avoid yarn-shop pastel and cottage twee. Layout must work at 375px wide with no horizontal scroll.

## Writing rules

- Plain, grounded prose. No marketing buzzwords, no "not X, but Y" rhetoric.
- **No em dashes** anywhere, in code comments, copy or docs. Use commas, colons, brackets or a full stop.
- Warm, communal tone for the site copy; no urgency language.

## How to work here

1. Pick the first unticked task in `docs/ROADMAP.md` whose dependencies are done, unless the session prompt names one.
2. Work on a branch named `task/<id>-<slug>` and open a pull request against `main`. Small docs-only fixes may go straight to `main`.
3. Keep tests green; add tests with the code, not after.
4. Before finishing: tick the task in `docs/ROADMAP.md`, append one line to `docs/LOG.md` (`- YYYY-MM-DD: T0N what changed, what is left`), and list open questions in the PR description instead of guessing.
5. If a task turns out to need a human call (a design direction, a historical judgement, a paid source), stop and write it up in the PR rather than choosing silently.
