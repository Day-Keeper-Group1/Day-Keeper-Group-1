import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// __dirname does not exist in an ES module, and this file has to be one so that
// Vite's native config loader stops warning about it.
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The contract tests are pure and fast: no database, no network. Tests that
    // do need the database should skip themselves with a clear message when
    // there is nothing to connect to, so that a teammate who has not started
    // Docker gets a hint rather than a wall of red.
    testTimeout: 20_000,
    env: {
      // The mock reader's deliberate slowness is for the interface, not for
      // assertions. Without this the suite spends ~25 of its ~27 seconds
      // sleeping. See src/server/extraction/mock-provider.ts.
      MOCK_EXTRACTION_DELAY_MS: "0",
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // `server-only` exists to make the Next.js bundler shout if a server
      // module is pulled into a client one. Outside the bundler it just throws,
      // which would stop us testing any server module at all, so under Vitest
      // it becomes an empty module.
      "server-only": resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
