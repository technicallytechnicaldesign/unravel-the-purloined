import "./style.css";
import { mountWordmarks } from "./ui/wordmark";
import { markSessionSeen } from "./ui/intro";
import { mountDecoder } from "./ui/decode";
import { takeProject, usableDraft } from "./ui/handover";
import { plateProject } from "./content/gallery";

markSessionSeen();
mountWordmarks();
const decoder = mountDecoder(document.querySelector<HTMLElement>("#decoder")!);
// Offer the alphabet being designed in the lab, without choosing it.
const draft = usableDraft();
if (draft) decoder.useAlphabet(draft, false);
const handed = takeProject();
// decode.html#plate=03: a gallery piece's settings with an empty grid, to copy from its picture.
const plate = /^#plate=(\d+)$/.exec(location.hash)?.[1];
if (plate)
  plateProject(plate).then((json) =>
    json ? decoder.loadBlank(json, `Plate ${plate}: the settings are set and the grid is empty. Copy the stitches from the gallery picture, row 1 at the bottom.`) : decoder.note(`Plate ${plate} has no pattern to open.`),
  );
else if (handed) decoder.loadJson(handed);
else if (location.hash === "#open-file") decoder.note("The pattern was saved as pattern.json in your downloads: open it under OPEN A PROJECT FILE.");
