import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One self-contained HTML file: every script, style and font is inlined so the mock
// can be published as a single page and opened from disk.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { codeSplitting: false } },
  },
});
