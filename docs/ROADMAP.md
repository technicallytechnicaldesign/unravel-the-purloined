# Roadmap and task list

Agents: take the first unticked task whose dependencies are ticked, unless your prompt names one. Each task lists what "done" means. Packet section numbers point into `docs/research/research-packet-v0.2.txt`.

Phases follow packet section 36. This file covers Phases 0 to 3 in detail; later phases stay as headings until earlier ones land.

## Phase 1a: engine core

- [x] **T01 Five-bit alphabet.** `src/engine/fivebit.ts`: normalize, encode, decode, A = 00000. Done when the packet's worked example (K P K P P decodes to L) and full round-trips pass. (Done 2026-09-26.)
- [x] **T02 Error control layer** (packet 24). `src/engine/errorcontrol.ts`: optional per-symbol parity bit, START/END framing, fixed separator cells, and a whole-message checksum. Decoder returns a structured report locating the first bad symbol ("possible error near character 14"). Done when: tests flip each single bit of an encoded message and the report names the right character every time; framing survives a missing leading cell. Flips outside a character (START, END, checksum) are reported by region, not by character. (Done 2026-09-26, with dropped/added cell detection: a slip is reported as a character range and reading resyncs.)
- [x] **T02b Hamming(9,5) symbol code** (packet 24.7). Optional mode in the error control layer that repairs one flipped cell per symbol and names it ("error at cell 83"). Done when every single flip in every symbol is repaired and reported. (Done 2026-09-26.)
- [ ] **T03 Morse encoder/decoder** (packet 27.1). Variable-length symbols with explicit symbol, letter and word gaps expressed as logical states (dot, dash, gap), not stitches. Done when round-trips pass for A-Z, 0-9 and space, and ambiguous input reports its position.
- [ ] **T04 Bacon biliteral mode** (packet 22.7, 27.3). Support the historical 24-letter alphabet (I/J and U/V merged) and a modern 26-letter variant; the UI must say which is in use. Done when both round-trip, and the historical mode's I/J, U/V merge is reported, not silent.
- [ ] **T05 Logical grid and layout** (packet 31, 37). `src/engine/grid.ts`: pour a bit stream into rows of a chosen width, with padding, border, and an asymmetric orientation marker so a decoder can tell top from bottom and right side from wrong side. Done when a grid can be rotated 180 degrees or mirrored and the decoder still recovers the message using the marker.

## Phase 1b: knitting output

- [ ] **T06 Construction translator** (packet 32). Converts a grid of desired right-side states into per-row needle actions for flat (alternating RS/WS rows, WS stitches inverted, reading direction flips) and in-the-round (every row RS). Done when tests confirm a flat WS row of "visible purl" becomes "k" and vice versa, and round knitting never inverts.
- [ ] **T07 Carriers: purl relief and two-colour** (packet 27.2, 27.4). A carrier maps logical states to visible states plus a legend. Done when the same grid renders through both carriers with no change to engine code above the carrier.
- [ ] **T08 Pattern output** (packet 36 Phase 2). Written row-by-row instructions with stitch-count checks, an SVG chart export, and the serializable project JSON from packet 37 (export and re-import round-trip). Done when a generated swatch pattern can be exported, re-imported and produces identical output.

## Phase 1c: the site

- [ ] **T09 Encode tool UI** (packet 34, tool aesthetic block). Message, transform, carrier, construction selects, then "generate signal": shows every pipeline stage in order. Mobile first at 375px. Depends on T02, T05, T06, T07.
- [ ] **T10 Manual grid decoder** (packet 28.1, 28.4). Click cells to mark knit/purl or colour A/B, pick width and mode, see bits, values and letters with the error report inline. Depends on T02, T05.
- [ ] **T11 Source verification pass** (packet 39). For each of S01 to S23: confirm the URL resolves, record what the page actually supports, and assign an evidence grade. Output `src/content/sources.json` (id, title, url, checked date, supports, grade, notes). Anything needing a library, a purchase or the physical 1942 book goes in a "needs a human" list in the PR. No new claims from memory.
- [ ] **T12 First history pages** (packet 04 to 07, 17, 35). Norway / red topplue, Grini, Belgium and espionage, a craft-resistance overview, and "Good story. Where's the evidence?". Each page uses the claim / date and place / grade / sources / what we know / what we do not know / related experiment template. Depends on T11 for the sources used.

## Phase 3: cipher lab (outline)

- [ ] **T13 Classical ciphers module**: Caesar, keyword substitution, Vigenere, rail fence and route transposition, each with encrypt, decrypt and tests, and each labelled historical / puzzle cipher in the UI.

## Later phases (headings only)

- Phase 4: cable, lace, bobble, bead, stripe-interval and motif-alphabet carriers.
- Phase 5: steganographic motif mutation (packet 27.12).
- Phase 6: secure mode with Web Crypto authenticated encryption.
- Phase 7: design-your-own textile language lab.
- Phase 8: photo decoder.
- Phase 9: community and archive features.
