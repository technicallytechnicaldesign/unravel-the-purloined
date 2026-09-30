import "./style.css";
import { mountWordmarks } from "./ui/wordmark";
import { markSessionSeen } from "./ui/intro";
import { mountGallery } from "./ui/gallery";

markSessionSeen();
mountWordmarks();
mountGallery(document.querySelector<HTMLElement>("#gallery")!);
