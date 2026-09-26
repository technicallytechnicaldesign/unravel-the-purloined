# Handoff

Where things stand, what is loose, and what to pick up next. Read `CLAUDE.md` first, then this. Update this file at the end of any session that changes the picture; keep it short.

Last updated 2026-09-26, project version 0.5.

## Where things stand

| Part | State | Code |
|---|---|---|
| Engine | Five-bit, Morse, Bacon; error control; logical grid with marker; classical ciphers; flat and round translation; recipes, borders, edges. | `src/engine/` |
| Carriers | Purl relief, two-colour, cable, lace, bobble, bead, stripes. Motif alphabet (pixel and geometric letters) as a separate layout. | `carrier.ts`, `units.ts`, `stripes.ts`, `glyphs.ts` |
| Hiding | Scatter in a filler, motif tiles; parcel key as JSON, typed code and printable card. | `stego.ts`, `motifs.ts`, `key.ts`, `unhide.ts` |
| Outputs | Written rows with abbreviations, SVG and PNG chart, print to PDF, XLSX, CSV, project JSON. | `pattern.ts`, `chartsvg.ts`, `xlsx.ts`, `project.ts` |
| Lab | Encoder in seven stages, manual grid decoder. | `src/ui/encode.ts`, `decode.ts` |
| Game | The Purloined Parcel, seven levels, drawn fabric. | `src/ui/game.ts`, `cases.ts`, `fabric.ts` |
| Museum | Five draft exhibits, hidden unless `?drafts`. The maker is writing these. | `content/exhibits/`, `src/content/sources.json` |

Tests: `npm test` (about 250). Build: `npm run build`. Browser checks so far used Playwright with the preinstalled Chromium at 375px, plus axe-core; no issues found.

## Waiting on the maker (do not decide these)

- **Playtest** of the game (G3, G4) and of the Phase 4 carriers. The maker is testing now.
- **Museum writing.** The maker wants to write exhibits personally. Leave `content/exhibits/` alone unless asked.
- **P4.7 swatches.** Real knitting to check block sizes, cable pull-in, lace leans and whether geometric symbols can be told apart in yarn.
- **Motif sizes stay as they are.** Motif hiding and the unit carriers multiply the size of the piece; they are meant for big projects (a blanket, a jumper, a shirt), and the lab says so. Do not shrink them.
- **Patterned fillers stay** as an option beside random texture.

## Loose ends

- **T11 is done** (21 of 23 checked). Six places where the drafts say more or other than their sources are listed in `docs/research/research-notes-2026-09-26.md` for the maker. S03 and S04 need a human (book pages), so the Belgium exhibit cannot publish yet. Smithsonian and nsa.gov block scripted fetches even locally; use Wayback snapshots.
- **G5** needs a real screen-reader session before it is ticked.
- **XLSX** has only been checked by tests and by parsing; nobody has opened one in Excel yet.
- **Old project files** (0.4 and earlier) import fine but report "regenerated from the settings", because the output gained `abbreviations`. Harmless; bump `PROJECT_VERSION` only if the settings shape changes.
- **Glyph notes** point at the bottom-left cell of the character in reading coordinates. The decoder only highlights them when the piece was read as knitted (not turned or mirrored).
- **Geometric symbols** are at least 2 stitches apart, so one slip is always reported but can be a tie between two symbols. Distance 3 would repair single slips but cannot fit 38 symbols in 3 × 3; a 4 × 4 pack could.
- **Stripes** are read from the cast-on edge; upside down they run backwards. The decoder assumes row 1 is the cast-on edge.
- **The game's fabric renderer** (`fabric.ts`) draws only knit, purl and two colours. Game levels with cables, lace or bobbles would need drawings for those.
- **Cable blocks** are 6 stitches wide per cell, so a 20-cell message is 120 stitches. Fine for a blanket; the width hint says so.

## Next phases

Suggested first tasks. Write them into `docs/ROADMAP.md` with acceptance criteria before starting a phase.

**Phase 6: secure mode** (packet phase 6, CLAUDE.md honesty rules).
1. `src/engine/secure.ts`: Web Crypto only. PBKDF2 (SHA-256, high iteration count) from a passphrase, random 16-byte salt, AES-GCM with a random 12-byte nonce. Output bytes: version, salt, nonce, ciphertext and tag. Round-trip tests, a wrong-passphrase test, a tampered-byte test.
2. Bytes to cells: a byte stream path through the grid (8 cells per byte, with the existing checksum idea). Expect about 45 bytes of overhead, so 360 or more cells even for a short message: say so plainly in the UI.
3. Lab UI: a "Secure (AES-GCM)" choice, clearly apart from the historical ciphers, with the copy rules: never "unbreakable"; the passphrase is the whole secret; nothing leaves the browser.

**Phase 7: design-your-own language.** Let people build an alphabet (symbol to cells) and a mapping onto a carrier, then generate encoder, decoder, printable key and legend. The glyph packs and parcel key are good starting points. Custom alphabets must be checked for distance and reported, the way `geometric()` is.

**Phase 8: photo decoder.** Research first, per the packet: colour grids are the easy start (sample a rectified photo into cells, then hand the grid to the existing decoder). Knit/purl, bobbles and lace are much harder. Everything stays in the browser.

**Phase 9: community and archive.** Gallery, shared alphabets, lesson plans, history packs. Needs decisions about hosting, since the site has no server and no accounts on purpose. Ask the maker before designing.

## Where to start next time

1. Read the maker's playtest notes (they may arrive as issues or in the session prompt) and fix what they found first.
2. Then Phase 6, task 1.
