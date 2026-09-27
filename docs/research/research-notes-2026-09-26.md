# Research notes, 2026-09-26

A local session (full network) did the T11 source pass and three packet 38 questions. What each source supports is in `src/content/sources.json`; this file holds the findings that change drafts or decisions.

How the pages were read: most pages directly. The Smithsonian hosts (si.edu, americanhistory, americanindian, folklife, siarchives) and nsa.gov refuse scripted access behind a bot check, so they were read from their latest Wayback Machine snapshots; the snapshot date is in each source's notes.

## T11: where the drafts and the sources disagree

The maker writes the exhibits, so these are flagged here and not changed in `content/exhibits/`.

| Exhibit | Draft says | Source says |
|---|---|---|
| norway | "A police prohibition on the red caps took effect on 26 February 1942" | S01 quotes a **Trondheim** police notice. It does not show a nationwide ban. Also: parents of children under 14 could be penalised. |
| grini | "Thread was salvaged from clothing, bedding and other material to hand" | S02: sanitary bandages, mattress stuffing and the prisoners' own clothing. About 2,000 women were held at Grini. |
| belgium | [B] [S03] networks "watched German rail transport" | S03 is only the publisher page; it mentions couriers, radio operators and reports, not rail watching. Needs page-level citation from the book. S03 is `needs-human`, so the claim cannot publish yet. |
| belgium | [B] [S04] the handbook "covers signals, Morse, signs, symbols and ciphers" | The subtitle lists flag code, secret ciphers, weather signals, Morse code, sign language and flags of all nations (62 pages, Whitman, Racine). S04 is `needs-human`. |
| cloth-as-resistance | arpilleras showing "repression, disappearance, poverty, detention and daily life" | S09 lists raids with tanks, children's soup kitchens, land occupations, water supply and unemployment. Disappearance and detention appear through the makers (relatives of the disappeared, detained and executed), not as listed subjects. |
| cloth-as-resistance | AIDS Quilt panels "each for one person" | S10 gives 1,920 panels on 11 October 1987 but not one person per panel; today it is nearly 50,000 panels for more than 110,000 people. |

Everything else checked out as drafted: khadi and the 1921 flag (S07), the banner and 13 June 1908 (S08), the pussyhat (S11), the Knitting Nannas, Lismore 2012 (S12), quilt codes as disputed (S14), the khipu object (S13), colonial boycotts and homespun (S05, S06, S23).

Useful finds for later pages: S18 tells the Elizabeth Wells Gallup story (typeface differences in the First Folio read as Bacon's As and Bs; dismissed from the International Bacon Society in 1900), a good companion for the evidence exhibit. S21: the Jefferson wheel link is itself labelled unproven by the museum.

## Needs a human

- **S04, the 1942 handbook.** Not on archive.org; Google Books has no preview. HathiTrust search sits behind a bot check, so someone should search it once by hand. Otherwise buy a used copy (a 62-page booklet, it turns up with dealers). The line quoted across the web ("Spies have been known to work code messages into knitting, embroidery, hooked rugs, etc.") has not been seen on the page.
- **S03, The White Lady.** Page-level citations for any rail or knitting claim.
- **The Trondheim police notice** itself, as a primary source (grade A).

## Braille dimensions (packet 38.6)

From the Braille Authority of North America page "Size and Spacing of Braille Characters":

| Standard | Dot base | Dot height | Dot to dot in cell | Cell to cell | Line to line |
|---|---|---|---|---|---|
| NLS Specification 800 (paper) | 1.44 mm | 0.48 mm | 2.34 mm | 6.2 mm | 10 mm |
| ANSI A117.1-2003 (signs) | 1.5 to 1.6 mm | 0.6 to 0.9 mm | 2.3 to 2.5 mm | 6.1 to 7.6 mm | 10.0 to 10.2 mm |
| Marburg Medium (pharma, from PharmaBraille) | not set | not set (ECMA Euro Braille: 0.5 mm) | 2.5 mm | 6.0 mm | |

What this means for a tactile mode (derived here, not measured): dots sit about 2.3 to 2.5 mm apart, which is finer than one stitch at most gauges (a fingering-weight stitch is roughly 3 to 3.5 mm wide). A knitted bobble or purl bump is also far larger than a 1.5 mm dome. So knitted dots cannot meet any Braille standard at normal gauges. A tactile mode should be named as an enlarged, Braille-shaped teaching model or a tactile code, never "Braille", per CLAUDE.md. A swatch would settle whether enlarged cells are readable by touch at all.

## Image rights (packet 38.7)

- Rights are per image, not per museum. Record the licence of every image next to it (a field beside the source id) and show it on the page.
- **Smithsonian:** the NMAI khipu record (S13) says there are restrictions on reusing its image. Smithsonian Open Access images marked CC0 are free to use; everything else is not. (The Open Access FAQ sits behind the same bot check and was not read; check the CC0 mark on each image.)
- **V&A:** content the V&A owns may be used free for non-commercial research, study, criticism and review, and teaching; commercial use goes through V&A Images. A public educational site is probably non-commercial, but it is not one of the named examples, so ask vaimages@vam.ac.uk before using any.
- **DigitaltMuseum (Norway, for Grini and red caps):** images marked with a CC licence or public domain can be downloaded and used at the published resolution, following the licence. Others need the owning museum.
- **Safe default:** use drawings made here (the game's fabric renderer already does this) or link to the museum's own page instead of copying the photo.

## Wider examples (packet 38.8 to 38.10)

Leads only: found through search and not yet read closely, so none is in the source register. Each needs a T11-style check before an exhibit uses it.

| Lead | What it is | Why it fits | Where to start |
|---|---|---|---|
| Luba lukasa (DR Congo) | Hand-held memory boards with beads and shells, read by members of the mbudye association | Beads as a memory device, read only by the trained | Met Museum object 690570; British Museum Af1954,23.2891 |
| Kanga (East Africa) | Printed cloth with a Swahili saying (jina) on every piece | Open textile messaging, everyday and not always political | Lam Museum of Anthropology; National Museums of Kenya on Google Arts & Culture |
| Wampum, Two Row belt (Haudenosaunee) | Shell bead belts recording agreements; two purple rows for two peoples travelling side by side | Beads as a record of a treaty | Onondaga Nation; NMAI "Nation to Nation" |
| Zulu beadwork "love letters" (South Africa) | Beaded pieces with colour meanings | Good for "Where's the evidence?": Museums Victoria warns that not every piece can be read like a letter and colour meanings vary | Museums Victoria article 16600 |

Other non-political signalling from packet 38.9 (maritime flags, tartans, military insignia) is already partly covered by the 1942 handbook's own subject list.
