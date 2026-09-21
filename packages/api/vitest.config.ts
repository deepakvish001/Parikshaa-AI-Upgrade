import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@parikshaa/core": src("core"),
      "@parikshaa/store": src("store"),
      "@parikshaa/viva": src("viva"),
    },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node", testTimeout: 30_000 },
});
