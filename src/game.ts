import "./style.css";
import { mountWordmarks } from "./ui/wordmark";
import { markSessionSeen } from "./ui/intro";
import { mountGame } from "./ui/game";

markSessionSeen();
mountWordmarks();
mountGame(document.querySelector<HTMLElement>("#game")!);
