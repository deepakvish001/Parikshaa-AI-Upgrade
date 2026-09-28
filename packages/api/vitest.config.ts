import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@parikshaa/core": src("core"),
      "@parikshaa/store": src("store"),
      "@parikshaa/viva": src("viva"),
      "@parikshaa/verify": src("verify"),
    },
  },
  // Each test's beforeEach builds a whole database (PGlite), which a busy
  // machine running every suite at once can take over ten seconds to do.
  test: { include: ["src/**/*.test.ts"], environment: "node", testTimeout: 30_000, hookTimeout: 30_000 },
});
