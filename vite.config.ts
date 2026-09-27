import { defineConfig } from "vitest/config";

// GitHub Pages serves the site from /unravel-the-purloined/.
export default defineConfig({
  base: "/unravel-the-purloined/",
  build: {
    rollupOptions: {
      input: { main: "index.html", lab: "lab.html", decode: "decode.html", game: "game.html", archive: "archive.html" },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
