import "./style.css";
import { mountWordmarks } from "./ui/wordmark";
import { markSessionSeen } from "./ui/intro";
import { mountArchive } from "./ui/archive";

markSessionSeen();
mountWordmarks();
mountArchive(document.querySelector<HTMLElement>("#archive")!);
