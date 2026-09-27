# Photo decoder research, 2026-09-27

Phase 8 starts with research, as packet section 28.5 and the Phase 8 roadmap ask. This note covers what others have done, what the browser can do, a small spike (`src/engine/photo.ts`) and an experiment on drawn fabric. It ends with proposed tasks and questions for the maker.

## In short

- **Colour grids are within reach.** A person taps the four corners of the chart and types the stitch and row counts. The lab then samples each cell and splits the colours into two groups. On drawn two-colour fabric this read every cell correctly under every condition tried, including all of them at once.
- **Knit and purl are harder, but not hopeless.** A single "which way do the edges run" number decoded only 15 of 54 drawn messages. Two better measures: the whole cell's lightness pattern is exact when the corners are tapped within about a tenth of a stitch but collapses beyond a third; a histogram of edge directions copes with sloppy taps but leaves 1 to 5% of cells wrong.
- **Everything so far is drawn fabric, not yarn.** The drawings come from the game's renderer. Real yarn has fuzz, halo, stranding showing through and colours closer in value. The next step needs photos of real swatches with known charts (P4.7).
- **Keep a person in the loop.** The reader fills the decoder's grid and marks the cells it doubts. The person checks those, then the ordinary error checks do the rest. Nothing is uploaded.

## What others have done

These are leads. The container's network blocks arxiv.org, proceedings.mlr.press, openaccess.thecvf.com, mdpi.com and news.mit.edu, so the papers were found by search but **not read**. Claims below come from search summaries and need a check before anything cites them.

| Work | What it is, per search summaries | Why it matters here |
|---|---|---|
| Kaspar et al., *Neural Inverse Knitting: From Images to Manufacturing Instructions*, ICML 2019 (PMLR 97:3272-3281); code at github.com/xionluhnis/neural_inverse_knitting (MIT licence) | Machine-knitted samples photographed and paired with their instructions. A network labels every stitch of a grid with one of 17 machine instructions (knit, purl, tuck, miss, transfer and more). About 94% accuracy is reported. Synthetic renders were mixed in, and making real photos look more synthetic helped. | Proof that stitch-level labelling from photos works for **machine** knitting at a known scale. Its "make photos look like renders" idea fits our drawn-fabric experiments. |
| Trunz et al., *Inverse Procedural Modeling of Knitwear*, CVPR 2019 | Finds stitch types and their positions from a single image of knitwear. | A non-network route to stitch localisation; worth reading for grid finding. |
| *Knitting Robots: A Deep Learning Approach for Reverse-Engineering Fabric Patterns*, Electronics 14(8):1605, 2025 | Two stages: front-face stitch labels from a photo, then the full machine stitch grid. F1 of 83.1% for the front labels is reported. | The front-face labels are what we need. 83% per stitch is far below what a message needs without error correction. |
| Knitted QR codes (Ravelry pattern "Knit a QR Code: do's and don'ts"; Stitch Fiddle help page) | People knit QR codes that phones scan: high contrast, a quiet zone round the code, and non-square stitches are tolerated. | Independent evidence that a phone can read a **colour** grid knitted by hand, when the code has strong error correction. |

None of this work is about hand knitting read by a browser, and none carries a message with its own error checks. That combination is ours.

## Browser tools

| Need | Options | Notes |
|---|---|---|
| Perspective correction | Our own 4-point homography (done in `photo.ts`, about 30 lines); `cv-homography` (MIT, a small subset of OpenCV.js); full OpenCV.js (several MB) | Own code is enough; no dependency needed. |
| Photo in | `<input type="file" accept="image/*" capture>` opens the camera on phones; `getUserMedia` for live video | The file input is simplest and keeps the photo local. |
| Automatic corners | ArUco markers via js-aruco2 (pure JavaScript, runs in the browser); or a knitted high-contrast border found by the lab | Markers would mean printing and pinning paper markers to the fabric. A knitted frame is more in keeping; it needs research. |
| Learned stitch classifier | ONNX Runtime Web or TensorFlow.js, with WebGPU where present and a WASM fallback; quantized vision models are typically a few MB to tens of MB | Only worth it with a real photo set to train or check on. Model size and licences need care. |

## The spike: `src/engine/photo.ts`

Pure functions on RGBA pixel arrays, with no DOM access, tested in `tests/photo.test.ts`.

1. `homography` maps the chart grid onto the four tapped corners (direct linear transform).
2. `sampleCells` measures each cell on a 9 × 9 lattice:
   - its mean colour in CIELAB, from the middle half of the cell;
   - `across`, the share of edge energy in horizontal edges;
   - `edges`, an 8-bin edge-direction histogram;
   - `patch`, lightness normalised to mean 0 and spread 1.
3. `classify` splits the cells into two groups (2-means). The darker colour, or the stitch with more edges running across, becomes 1. The decoder already tries inversions anyway. It returns a confidence for each cell and a list of doubtful cells.
4. `refineQuad` ("settle") nudges each corner by fractions of a cell towards the position where the groups separate most cleanly.

## Experiment

`scripts/photo-experiment.ts` does the following for each trial:

1. Knits "MEET AT NOON" (five-bit alphabet, Hamming, 16 stitches wide), draws it with the game's fabric renderer and rasterizes it in Chromium.
2. Places the drawing in a 900 × 700 "photo" through a random perspective, then adds light falling off across the frame, 3 × 3 box blur passes, noise and a JPEG round trip.
3. Taps the corners with random error, then reads and decodes.

Each condition changes one thing from a middling baseline (tilt 0.15, light 0.3, noise 8, blur 1, JPEG 0.8, taps within 2 px, wobble 0.5), plus one "everything bad" case. Three seeds each. A stitch is about 20 px wide in the photo.

Run it with `npm i --no-save playwright && npx vite-node scripts/photo-experiment.ts`.

Summary over the 18 conditions (54 trials per row). Full table: `photo-sweep-2026-09-27.md`.

| Carrier | Reading | Messages decoded | Mean cell errors | Worst condition |
|---|---|---|---|---|
| Two-colour | colour (Lab) | 54 of 54 | 0.0% | none |
| Two-colour | hue (colour without lightness) | 54 of 54 | 0.0% | none |
| Two-colour | hue, corners settled | 54 of 54 | 0.0% | none |
| Purl relief | shape (lightness pattern) | 45 of 54 | 5.6% | taps 12 px off: 46.5% |
| Purl relief | shape, corners settled | 47 of 54 | 5.7% | taps 12 px off: 46.5% |
| Purl relief | edge histogram | 37 of 54 | 2.0% | taps exact: 5.4% |
| Purl relief | edge histogram, corners settled | 35 of 54 | 1.2% | no light fall-off: 2.2% |
| Purl relief | edges across (one number) | 15 of 54 | 8.5% | no blur: 28.2% |

An earlier run with five seeds, stopped before it finished, also tried parity instead of Hamming for the colour readings. It covered 62 of the 72 condition rows and gave the same result: every cell right and every message decoded.

### What the numbers say

- **Colour** is not the hard part. Tilt, light fall-off, noise, blur, heavy JPEG and taps 12 px off (more than half a stitch) changed nothing on drawn fabric.
- **Knit/purl, shape reading** is exact whenever the taps land within about 2 px, a tenth of a stitch, under any light, noise or blur tried. At 6 px it breaks, and settling the corners does not rescue it; a better settling search is worth trying. With a magnifier for tapping, this may still be the best reading.
- **Knit/purl, edge histogram** tolerates sloppy taps but leaves 1 to 5% of cells wrong, spread out enough that Hamming repairs many letters but not every message.
- **The single "edges across" number** is not good enough; it stays in the code only as a baseline.
- Blur helped the edge readings (fewer errors at 3 blur passes than at none): the drawn outlines are sharper than yarn. Real photos will differ.
- Not measured yet: how many wrong cells fall among those marked doubtful. That decides whether "check the marked cells" is enough for a person, and it is the first thing to measure on real photos.

### What they do not say

- Drawn fabric has clean outlines and flat colour. Yarn does not.
- One stitch size and one message length were tried. Real photos may put fewer pixels on each stitch.
- Row heights in the drawings vary a little (the wobble setting), but a real piece can bias or curl, which a four-corner grid cannot follow. A grid bent to fit, or more tapped points along the edges, may be needed.

## Per carrier outlook

| Carrier | Outlook | Idea |
|---|---|---|
| Two-colour | Good | Colour reading as in the spike. Similar-value pairs (navy and black) need a test. |
| Stripes | Good | A colour per row; simpler than a grid. |
| Purl relief | Uncertain | Shape reading with a magnifier for exact taps, or edge histograms; raking light from the side; a person checking doubtful cells. |
| Motif alphabets | Follows the carrier | Read the cells, then `readGlyphs` as now. Distance 3 packs repair misread cells. |
| Lace | Promising, untested | Hold the piece up to a window: eyelets become bright dots, which turns lace into a colour problem. |
| Bobbles | Uncertain | Raised blobs cast shadows under side light; blob detection per block. |
| Beads | Uncertain | Shiny highlights; depends on the beads. |
| Cables | Hard | Crossing direction is subtle; probably needs a trained model and real photos. |

## Privacy and honesty

- Photos stay in the browser. No upload, no model calls to a server. If a learned model is added later, it ships with the site and runs locally.
- Photo reading is an aid, not an oracle. The lab should show the grid it read, mark doubtful cells, and let the person correct it. Error reports then work as they do for typed grids.

## Follow-up, same day: the lab reads photos

- `findFrame` finds a border in the darker yarn without taps. It splits the colours in the middle of the photo into two yarns, marks everything near the darker one, keeps the largest joined patch, and takes that patch's farthest points towards each corner. In tests it lands within 4 px of the true corners on a tilted, shaded, noisy photo.
- A "light" reading compares lightness only, for lace held against a window.
- End to end in Chromium: a drawn two-colour piece with a 2-stitch frame was tilted in 3D, saved as JPEG at quality 80 and opened on the decoder page. The frame was found with no taps, all 270 cells were read with none marked doubtful, and the message decoded. Drawn fabric again, so real photos (8.3) are still the test that counts.

## Proposed tasks

See `docs/ROADMAP.md`, Phase 8.

## Questions for the maker

1. **Real photos.** When the P4.7 swatches are knitted, could each be photographed three ways: flat in daylight, flat in lamp light, and with light from one side? The charts are known, so each photo becomes a test case. Knit/purl and lace (against a window) matter most.
2. **Corner taps or knitted frame?** Tapping four corners is simple and works. A contrasting knitted frame could let the lab find the corners itself, but it changes how finished pieces look. Which do you prefer?
3. **Learned models.** A trained stitch classifier would add megabytes to the site and needs training photos. Worth exploring later, or keep the lab model-free?
