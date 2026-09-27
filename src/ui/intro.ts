// The home-page entrance is a short reading of the knitted title.
// A visit on any other page marks the session so Home never replays it.

const KEY = "utp-intro-seen";

export function markSessionSeen(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // A blocked storage area simply leaves the entrance off.
  }
}

export function mountIntro(): void {
  const html = document.documentElement;
  const intro = document.querySelector<HTMLElement>("#intro");
  if (!intro) return;
  if (!html.classList.contains("intro-pending")) {
    intro.remove();
    return;
  }
  markSessionSeen();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    html.classList.remove("intro-pending");
    intro.remove();
    return;
  }

  let finished = false;
  let timer: number;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    html.classList.add("intro-leaving");
    window.setTimeout(() => {
      html.classList.remove("intro-pending", "intro-running", "intro-leaving");
      intro.remove();
      document.querySelector<HTMLElement>(".door")?.focus({ preventScroll: true });
    }, 320);
  };
  intro.querySelector<HTMLButtonElement>(".intro-skip")?.addEventListener("click", finish);
  intro.querySelector<HTMLButtonElement>(".intro-skip")?.focus({ preventScroll: true });
  requestAnimationFrame(() => html.classList.add("intro-running"));
  timer = window.setTimeout(finish, 2650);
}
