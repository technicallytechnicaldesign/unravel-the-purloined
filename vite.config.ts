import { defineConfig } from "vitest/config";

// GitHub Pages serves the site from /unravel-the-purloined/.
export default defineConfig({
  base: "/unravel-the-purloined/",
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
