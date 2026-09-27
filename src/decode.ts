import "./style.css";
import { mountWordmarks } from "./ui/wordmark";
import { mountDecoder } from "./ui/decode";
import { takeProject, usableDraft } from "./ui/handover";

mountWordmarks();
const decoder = mountDecoder(document.querySelector<HTMLElement>("#decoder")!);
// Offer the alphabet being designed in the lab, without choosing it.
const draft = usableDraft();
if (draft) decoder.useAlphabet(draft, false);
const handed = takeProject();
if (handed) decoder.loadJson(handed);
else if (location.hash === "#open-file") decoder.note("The pattern was saved as pattern.json in your downloads: open it under OPEN A PROJECT FILE.");
