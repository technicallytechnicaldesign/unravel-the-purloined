# Unravel the Purloined

A museum of craft resistance, and a lab for hiding messages in thread.

**Live:** https://technicallytechnicaldesign.github.io/unravel-the-purloined/

Textiles have carried messages openly, indirectly and secretly: red caps banned in occupied Norway, prison embroidery at Grini, homespun boycotts, suffrage banners, arpilleras, memorial quilts. This project collects those histories with their evidence shown, then treats thread as an information medium: type a message, choose a cipher and a carrier, and get a pattern you can actually knit, plus a decoder that shows every step back to the text.

The name comes from Poe's *The Purloined Letter*, where the letter stays hidden by sitting in plain sight, and from unravelling, which is both decoding and pulling out your knitting.

## Status

Working, and growing. Three parts are live:

- **The lab** (`lab.html`): encode a message (five-bit, Morse or Bacon, with optional classical ciphers and error checks) into a knit/purl or two-colour pattern for flat or round knitting, with chart, written rows and exports; decode a grid back to text with every step shown.
- **The Purloined Parcel** (`game.html`): six case files of knitted evidence to read and decode.
- **The archive** (`archive.html`): exhibits with evidence grades. Drafts stay private until their sources are checked; to write one, see `content/README.md`.

See `docs/ROADMAP.md` for what comes next.

## Develop

```bash
npm install
npm run dev     # local site
npm test        # engine tests
npm run build   # production build to dist/
```

## Principles

- Data and textile stay separate until late in the pipeline, so one message can become knit/purl, colourwork, cables or lace.
- Every historical claim carries an evidence grade, from documented to disputed.
- Classical ciphers are for history and puzzles. Anything called secure uses established browser cryptography, never a home-made scheme.

Research brief: `docs/research/research-packet-v0.2.txt`.
