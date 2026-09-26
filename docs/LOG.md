# Log

One line per session, newest last. Append only.

- 2026-09-26: Repo created from research packet v0.2 (working title STITCH / SIGNAL, renamed Unravel the Purloined). Vite + TypeScript + Vitest stack, Pages deploy workflow, T01 five-bit alphabet with round-trip tests, landing page with live title chart.
- 2026-09-26: T02 and T02b error control layer: START/END framing, plain/parity/Hamming(9,5) symbol codes, separator cells, Fletcher-style checksum, frame search that survives missing or extra leading cells, slip detection with resync and honest ranges. Added docs/PROJECT.md. Left: Hamming double errors miscorrect (known limit of the code); no burst or majority-vote redundancy yet (packet 24.6).
- 2026-09-26: T03 Morse (elements, ITU timing units, run-length decoder that reports off-length marks and gaps by unit) and T04 Bacon biliteral (historical 24 and modern 26 alphabets, I/J and U/V merge reported both ways). Shared normalizer moved to src/engine/normalize.ts. Left: T05 grid, T06 flat vs round.
- 2026-09-26: T05 logical grid (chart coordinates, orientation marker, top row, padding, optional border; decoder recovers from all 8 turns and inversions) and T06 construction translator (flat RS/WS with inversion and reading direction, round never inverts, colour never inverts, inverse included). Left: T07 carriers, T08 pattern output.
