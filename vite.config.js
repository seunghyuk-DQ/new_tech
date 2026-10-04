import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cp } from "node:fs/promises";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "copy-notes",
      async closeBundle() {
        if (mode === "bookmark") return;
        await Promise.all([
          cp("content", "dist/content", { recursive: true }),
          cp("assets/research", "dist/assets/research", { recursive: true }),
        ]);
      },
    },
  ],
  resolve: { alias: { "@": resolve("src") } },
  build: {
    rollupOptions: {
      input: { index: resolve("index.html"), notes: resolve("new_tech.html") },
    },
  },
}));
