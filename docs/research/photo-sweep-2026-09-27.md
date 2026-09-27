# Photo reader sweep, 2026-09-27

Full output of `scripts/photo-experiment.ts` on drawn fabric: three seeds per row, message "MEET AT NOON", five-bit alphabet with Hamming, 16 stitches wide. Cell errors and doubtful cells are shares of all cells; decoded counts messages read back exactly. See `photo-decoder-2026-09-27.md` for what this does and does not show.

| carrier | feature | code | case | cell errors | doubtful | decoded |
|---|---|---|---|---|---|---|
| two-colour | hue | hamming | baseline | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | tilt 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | tilt 0.3 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | tilt 0.5 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | light 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | light 0.6 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | noise 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | noise 30 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | blur 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | blur 3 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | jpeg 1 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | jpeg 0.4 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | tap 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | tap 6 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | tap 12 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | wobble 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | wobble 1 | 0.0% | 0.0% | 3/3 |
| two-colour | hue | hamming | everything bad | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | baseline | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | tilt 0 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | tilt 0.3 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | tilt 0.5 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | light 0 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | light 0.6 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | noise 0 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | noise 30 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | blur 0 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | blur 3 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | jpeg 1 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | jpeg 0.4 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | tap 0 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | tap 6 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | tap 12 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | wobble 0 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | wobble 1 | 0.0% | 0.0% | 3/3 |
| two-colour | colour | hamming | everything bad | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | baseline | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | tilt 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | tilt 0.3 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | tilt 0.5 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | light 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | light 0.6 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | noise 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | noise 30 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | blur 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | blur 3 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | jpeg 1 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | jpeg 0.4 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | tap 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | tap 6 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | tap 12 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | wobble 0 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | wobble 1 | 0.0% | 0.0% | 3/3 |
| two-colour | hue + settle | hamming | everything bad | 0.0% | 0.0% | 3/3 |
| purl-relief | texture | hamming | baseline | 7.5% | 9.5% | 1/3 |
| purl-relief | texture | hamming | tilt 0 | 9.5% | 9.5% | 0/3 |
| purl-relief | texture | hamming | tilt 0.3 | 6.1% | 8.3% | 1/3 |
| purl-relief | texture | hamming | tilt 0.5 | 3.2% | 6.9% | 1/3 |
| purl-relief | texture | hamming | light 0 | 8.0% | 9.1% | 1/3 |
| purl-relief | texture | hamming | light 0.6 | 7.7% | 9.0% | 1/3 |
| purl-relief | texture | hamming | noise 0 | 7.1% | 9.0% | 1/3 |
| purl-relief | texture | hamming | noise 30 | 11.7% | 9.5% | 1/3 |
| purl-relief | texture | hamming | blur 0 | 28.2% | 13.5% | 0/3 |
| purl-relief | texture | hamming | blur 3 | 0.3% | 0.5% | 3/3 |
| purl-relief | texture | hamming | jpeg 1 | 7.1% | 9.8% | 1/3 |
| purl-relief | texture | hamming | jpeg 0.4 | 7.7% | 10.6% | 1/3 |
| purl-relief | texture | hamming | tap 0 | 12.2% | 11.1% | 0/3 |
| purl-relief | texture | hamming | tap 6 | 5.0% | 6.4% | 0/3 |
| purl-relief | texture | hamming | tap 12 | 10.9% | 8.7% | 0/3 |
| purl-relief | texture | hamming | wobble 0 | 13.5% | 11.1% | 0/3 |
| purl-relief | texture | hamming | wobble 1 | 6.4% | 7.9% | 1/3 |
| purl-relief | texture | hamming | everything bad | 1.4% | 3.8% | 2/3 |
| purl-relief | edges | hamming | baseline | 1.4% | 18.4% | 3/3 |
| purl-relief | edges | hamming | tilt 0 | 2.2% | 21.2% | 2/3 |
| purl-relief | edges | hamming | tilt 0.3 | 1.4% | 15.1% | 2/3 |
| purl-relief | edges | hamming | tilt 0.5 | 0.5% | 14.3% | 2/3 |
| purl-relief | edges | hamming | light 0 | 0.6% | 15.7% | 3/3 |
| purl-relief | edges | hamming | light 0.6 | 1.9% | 18.9% | 1/3 |
| purl-relief | edges | hamming | noise 0 | 0.8% | 15.5% | 3/3 |
| purl-relief | edges | hamming | noise 30 | 2.9% | 37.0% | 2/3 |
| purl-relief | edges | hamming | blur 0 | 5.3% | 26.4% | 0/3 |
| purl-relief | edges | hamming | blur 3 | 0.0% | 4.6% | 3/3 |
| purl-relief | edges | hamming | jpeg 1 | 0.8% | 16.5% | 3/3 |
| purl-relief | edges | hamming | jpeg 0.4 | 1.0% | 18.6% | 3/3 |
| purl-relief | edges | hamming | tap 0 | 5.4% | 19.6% | 0/3 |
| purl-relief | edges | hamming | tap 6 | 2.9% | 14.3% | 1/3 |
| purl-relief | edges | hamming | tap 12 | 4.8% | 25.5% | 2/3 |
| purl-relief | edges | hamming | wobble 0 | 1.4% | 12.5% | 2/3 |
| purl-relief | edges | hamming | wobble 1 | 2.1% | 20.2% | 3/3 |
| purl-relief | edges | hamming | everything bad | 1.3% | 15.5% | 2/3 |
| purl-relief | edges + settle | hamming | baseline | 1.0% | 9.9% | 1/3 |
| purl-relief | edges + settle | hamming | tilt 0 | 0.8% | 8.2% | 3/3 |
| purl-relief | edges + settle | hamming | tilt 0.3 | 1.6% | 9.6% | 1/3 |
| purl-relief | edges + settle | hamming | tilt 0.5 | 1.3% | 8.8% | 2/3 |
| purl-relief | edges + settle | hamming | light 0 | 2.2% | 9.5% | 1/3 |
| purl-relief | edges + settle | hamming | light 0.6 | 1.1% | 7.9% | 1/3 |
| purl-relief | edges + settle | hamming | noise 0 | 1.1% | 9.8% | 2/3 |
| purl-relief | edges + settle | hamming | noise 30 | 2.2% | 18.8% | 2/3 |
| purl-relief | edges + settle | hamming | blur 0 | 1.4% | 13.9% | 2/3 |
| purl-relief | edges + settle | hamming | blur 3 | 0.2% | 4.6% | 3/3 |
| purl-relief | edges + settle | hamming | jpeg 1 | 1.4% | 7.4% | 2/3 |
| purl-relief | edges + settle | hamming | jpeg 0.4 | 0.6% | 10.1% | 3/3 |
| purl-relief | edges + settle | hamming | tap 0 | 1.9% | 8.7% | 0/3 |
| purl-relief | edges + settle | hamming | tap 6 | 1.1% | 6.4% | 2/3 |
| purl-relief | edges + settle | hamming | tap 12 | 1.6% | 9.6% | 3/3 |
| purl-relief | edges + settle | hamming | wobble 0 | 0.3% | 7.5% | 2/3 |
| purl-relief | edges + settle | hamming | wobble 1 | 2.1% | 13.1% | 2/3 |
| purl-relief | edges + settle | hamming | everything bad | 0.2% | 9.3% | 3/3 |
| purl-relief | shape | hamming | baseline | 0.0% | 2.6% | 3/3 |
| purl-relief | shape | hamming | tilt 0 | 0.0% | 2.6% | 3/3 |
| purl-relief | shape | hamming | tilt 0.3 | 0.0% | 2.9% | 3/3 |
| purl-relief | shape | hamming | tilt 0.5 | 0.0% | 3.0% | 3/3 |
| purl-relief | shape | hamming | light 0 | 0.0% | 2.7% | 3/3 |
| purl-relief | shape | hamming | light 0.6 | 0.0% | 2.6% | 3/3 |
| purl-relief | shape | hamming | noise 0 | 0.0% | 2.6% | 3/3 |
| purl-relief | shape | hamming | noise 30 | 0.0% | 3.7% | 3/3 |
| purl-relief | shape | hamming | blur 0 | 0.0% | 5.0% | 3/3 |
| purl-relief | shape | hamming | blur 3 | 0.0% | 1.1% | 3/3 |
| purl-relief | shape | hamming | jpeg 1 | 0.0% | 2.4% | 3/3 |
| purl-relief | shape | hamming | jpeg 0.4 | 0.0% | 2.6% | 3/3 |
| purl-relief | shape | hamming | tap 0 | 0.0% | 0.0% | 3/3 |
| purl-relief | shape | hamming | tap 6 | 22.0% | 52.6% | 0/3 |
| purl-relief | shape | hamming | tap 12 | 46.5% | 82.7% | 0/3 |
| purl-relief | shape | hamming | wobble 0 | 0.0% | 0.2% | 3/3 |
| purl-relief | shape | hamming | wobble 1 | 0.0% | 17.6% | 3/3 |
| purl-relief | shape | hamming | everything bad | 33.0% | 70.4% | 0/3 |
| purl-relief | shape + settle | hamming | baseline | 0.0% | 2.4% | 3/3 |
| purl-relief | shape + settle | hamming | tilt 0 | 0.0% | 2.4% | 3/3 |
| purl-relief | shape + settle | hamming | tilt 0.3 | 0.0% | 1.3% | 3/3 |
| purl-relief | shape + settle | hamming | tilt 0.5 | 0.0% | 0.5% | 3/3 |
| purl-relief | shape + settle | hamming | light 0 | 0.0% | 2.2% | 3/3 |
| purl-relief | shape + settle | hamming | light 0.6 | 0.0% | 2.2% | 3/3 |
| purl-relief | shape + settle | hamming | noise 0 | 0.0% | 2.2% | 3/3 |
| purl-relief | shape + settle | hamming | noise 30 | 0.0% | 1.9% | 3/3 |
| purl-relief | shape + settle | hamming | blur 0 | 0.0% | 3.0% | 3/3 |
| purl-relief | shape + settle | hamming | blur 3 | 0.0% | 1.0% | 3/3 |
| purl-relief | shape + settle | hamming | jpeg 1 | 0.0% | 2.2% | 3/3 |
| purl-relief | shape + settle | hamming | jpeg 0.4 | 0.0% | 2.2% | 3/3 |
| purl-relief | shape + settle | hamming | tap 0 | 0.0% | 0.0% | 3/3 |
| purl-relief | shape + settle | hamming | tap 6 | 23.6% | 33.3% | 1/3 |
| purl-relief | shape + settle | hamming | tap 12 | 46.5% | 30.8% | 0/3 |
| purl-relief | shape + settle | hamming | wobble 0 | 0.0% | 0.0% | 3/3 |
| purl-relief | shape + settle | hamming | wobble 1 | 0.0% | 12.8% | 3/3 |
| purl-relief | shape + settle | hamming | everything bad | 31.7% | 29.3% | 1/3 |
