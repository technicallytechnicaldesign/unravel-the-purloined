import "./style.css";
import { mountWordmarks } from "./ui/wordmark";
import { mountEncoder } from "./ui/encode";
import { mountDesigner } from "./ui/designer";
import { sendToDecoder } from "./ui/handover";

mountWordmarks();
const encoder = mountEncoder(document.querySelector<HTMLElement>("#encoder")!, sendToDecoder);
mountDesigner(document.querySelector<HTMLElement>("#designer")!, (a) => {
  encoder.useAlphabet(a);
  document.querySelector("#enc-h")!.scrollIntoView({ behavior: "smooth" });
});
