# Gallery and archive development kit
2026-10-06. Maker-approved directions: inspection table, on-the-needles photographs and SW01 frogging.
Open studies.html via npm run dev; it ships in the Pages build and is linked from the gallery.

## Structure
- src/studies.ts and src/studies.css: three SW01 gallery studies, two interactive lessons and two diagrams.
- src/content/study-sw01.json: surface rebuilt from written rows, metadata and photo paths.
- public/development/sw01/: copies of prepared photos; research originals remain unchanged.
- public/development/assets/: editable SVG stitch states, reading mask, encryption pipeline and schematic cap.
- public/development/captures/: empty knitting and frogging manifests.
- src/content/capture-sequence.ts: shared metadata contract and validator.
- CAPTURE.md: capture instructions. STORYBOARDS.md: animation scenes.

## Evidence boundaries
MEASURED: photographs show actual SW01 fabric.
LOGGED: the chart comes from existing surface.json, reconstructed from written pattern rows.
ASSUMED: matching the physical stitches to that chart remains pending until a hand trace/read-back.
Drawn sequences are not recorded knitting; no footage, trace or aligned photo overlay is invented.
Intended text is revealed separately from verified physical read-back.
Playback is visitor-controlled and pauses on study changes or page hiding.
The decoder link stays generic until the original saved engine project is recovered.

## Next slices
1. Ingest photographs, validate capture order and orientation.
2. Build a photographic sequence player with preloading and missing-frame handling.
3. Align photo/chart after anchors and a hand trace exist, retaining doubtful cells.
4. Extend lessons using actual steganography and encryption outputs with step/pause controls.
5. Refine the production gallery after comparing these studies on phone and desktop.

## Public draft policy
visibility: public is an explicit Markdown opt-in, independent of status: draft.
Public listing and direct links still require checked citations for every claim.
The red cap is opted in. Other drafts stay hidden except in development or with ?drafts.
Editorial ownership remains with the maker; only the chosen entry's sourced Trondheim scope was corrected.
