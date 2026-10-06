import { defineConfig } from "vitest/config";

// GitHub Pages serves the site from /unravel-the-purloined/.
export default defineConfig({
  base: "/unravel-the-purloined/",
  // Keep canonical junction paths consistent in local Vitest runs.
  resolve: { preserveSymlinks: true },
  build: {
    rollupOptions: {
      input: { main: "index.html", lab: "lab.html", decode: "decode.html", game: "game.html", archive: "archive.html", gallery: "gallery.html", studies: "studies.html" },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
