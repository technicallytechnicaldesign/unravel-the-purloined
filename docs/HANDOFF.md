# Handoff

Where things stand, what is loose, and what to pick up next. Read `CLAUDE.md` first, then this. Update this file at the end of any session that changes the picture; keep it short.

Last updated 2026-09-27 (playtest round 1), project version 0.5.

## Where things stand

| Part | State | Code |
|---|---|---|
| Engine | Five-bit, Morse, Bacon; error control; logical grid with marker; classical ciphers; flat and round translation; recipes, borders, edges. | `src/engine/` |
| Carriers | Purl relief, two-colour, cable, lace, bobble, bead, stripes. Motif alphabet (pixel and geometric letters) as a separate layout. | `carrier.ts`, `units.ts`, `stripes.ts`, `glyphs.ts` |
| Hiding | Scatter in a filler, motif tiles; parcel key as JSON, typed code and printable card. | `stego.ts`, `motifs.ts`, `key.ts`, `unhide.ts` |
| Outputs | Written rows with abbreviations, SVG and PNG chart, print to PDF, XLSX, CSV, project JSON. | `pattern.ts`, `chartsvg.ts`, `xlsx.ts`, `project.ts` |
| Secure mode | PBKDF2 + AES-GCM via Web Crypto; bytes as letters A to P through the normal alphabets and error checks. | `secure.ts` |
| Alphabets | Design your own: checks (duplicates, one-stitch pairs, turned look-alikes, blanks), suggestions, JSON files, printable legend; stored inside project files. | `alphabet.ts` |
| Photo | Four-corner homography, cell sampling, readings for colour, knit/purl and lace against light, doubtful cells, corner settling, frame finding. On the decoder page as READ FROM A PHOTO. | `photo.ts`, `src/ui/photoread.ts`, `scripts/photo-experiment.ts` |
| Lab | `lab.html`: two paths (a message first, or a piece to knit first) with stages that fold to summaries; alphabet designer folded below. `decode.html`: the decoder, fed from the lab by `handover.ts`. | `src/ui/encode.ts`, `decode.ts`, `designer.ts`, `handover.ts` |
| Site frame | Knitted wordmarks: the site title on every page (linking home) and each page's own title (`data-wordmark`). The home page is only the three ways in. | `wordmark.ts`, `index.html` |
| Game | The Purloined Parcel, seven levels, drawn fabric, a primer on knit, purl and the marker row. | `src/ui/game.ts`, `tutorial.ts`, `cases.ts`, `fabric.ts` |
| Museum | Five draft exhibits, hidden unless `?drafts`. The maker is writing these. | `content/exhibits/`, `src/content/sources.json` |

Tests: `npm test` (about 285). Build: `npm run build`. Browser checks so far used Playwright with the preinstalled Chromium at 375px, plus axe-core; no issues found.

## Waiting on the maker (do not decide these)

- **Playtest.** First notes arrived 2026-09-27 and are done (Phase P1). The game plays well; G3 and G4 can be ticked once the maker confirms every level was tried.
- **Museum writing.** The maker wants to write exhibits personally. Leave `content/exhibits/` alone unless asked.
- **P4.7 swatches.** The maker has agreed to knit these; it will take a while. Real knitting to check block sizes, cable pull-in, lace leans and whether geometric symbols can be told apart in yarn.
- **Motif sizes stay as they are.** Motif hiding and the unit carriers multiply the size of the piece; they are meant for big projects (a blanket, a jumper, a shirt), and the lab says so. Do not shrink them.
- **Patterned fillers stay** as an option beside random texture.

## Loose ends

- **T11 is done** (21 of 23 checked). Six places where the drafts say more or other than their sources are listed in `docs/research/research-notes-2026-09-26.md` for the maker. S03 and S04 need a human (book pages), so the Belgium exhibit cannot publish yet. Smithsonian and nsa.gov block scripted fetches even locally; use Wayback snapshots.
- **G5** needs a real screen-reader session before it is ticked.
- **XLSX** has only been checked by tests and by parsing; nobody has opened one in Excel yet.
- **Old project files** (0.4 and earlier) import fine but report "regenerated from the settings", because the output gained `abbreviations`. Harmless; bump `PROJECT_VERSION` only if the settings shape changes.
- **Glyph notes** point at the bottom-left cell of the character in reading coordinates. The decoder only highlights them when the piece was read as knitted (not turned or mirrored).
- **Geometric symbols**: the 3 × 3 pack only reports a slip (distance 2, can tie). The 4 × 4 pack (P4.8) repairs one slip per symbol from any turn. Neither pack may change: saved projects depend on them.
- **Secure mode size.** 45 bytes of overhead and two letters per byte, so even a short message makes a blanket-sized piece. Projects store only the letters; the decoder asks for the passphrase.
- **Custom alphabets** live in project files, a per-browser draft and a share code (`UTPA1-...`). They cannot go in a parcel key: keys are for hidden messages, and motif alphabets show their letters openly.
- **Network in cloud sessions** blocks many paper hosts (arxiv.org, proceedings.mlr.press, openaccess.thecvf.com, mdpi.com, news.mit.edu). GitHub works. Read papers from a local session, or ask the maker to allow those hosts.
- **Stripes** are read from the cast-on edge; upside down they run backwards. The decoder assumes row 1 is the cast-on edge.
- **The game's fabric renderer** (`fabric.ts`) draws only knit, purl and two colours. Game levels with the Phase 4 carriers are parked under Future directions in the roadmap, by the maker's choice.
- **Cable blocks** are 6 stitches wide per cell, so a 20-cell message is 120 stitches. Fine for a blanket; the width hint says so.

## Next phases

Suggested first tasks. Write them into `docs/ROADMAP.md` with acceptance criteria before starting a phase.

**Phase 6: secure mode** is built (6.1 to 6.3); 6.4 waits on the maker reading the copy.

**Phase 7: design your own alphabet** is built (7.1 to 7.4). Ideas left for later: a short share code for alphabets (like the parcel key code), custom alphabets inside a parcel key, and a game level built on a player's own alphabet.

**Phase 8: photo decoder.** Research and spike done (8.1, 8.2): see `docs/research/photo-decoder-2026-09-27.md`. Colour grids read reliably on drawn fabric; knit/purl only partly. 8.3 needs real swatch photos from the maker; 8.4 (lab UI for colour photos) can start now.

**Phase 9: community and archive.** Gallery, shared alphabets, lesson plans, history packs. Needs decisions about hosting, since the site has no server and no accounts on purpose. Ask the maker before designing.

## Where to start next time

1. Any new playtest notes first.
2. When the swatch photos arrive (8.3): run them through the photo reader, measure how many wrong cells fall among the doubtful ones, and finish 8.5.
3. Game levels with cables, lace or bobbles need drawings for those stitches in `fabric.ts` first; a medium-sized job the maker has parked as a nice-to-have.
4. Phase 9 once the maker has decided on hosting.
