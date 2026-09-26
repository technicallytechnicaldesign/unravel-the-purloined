# Log

One line per session, newest last. Append only.

- 2026-09-26: Repo created from research packet v0.2 (working title STITCH / SIGNAL, renamed Unravel the Purloined). Vite + TypeScript + Vitest stack, Pages deploy workflow, T01 five-bit alphabet with round-trip tests, landing page with live title chart.
- 2026-09-26: T02 and T02b error control layer: START/END framing, plain/parity/Hamming(9,5) symbol codes, separator cells, Fletcher-style checksum, frame search that survives missing or extra leading cells, slip detection with resync and honest ranges. Added docs/PROJECT.md. Left: Hamming double errors miscorrect (known limit of the code); no burst or majority-vote redundancy yet (packet 24.6).
