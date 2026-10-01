import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// __dirname does not exist in an ES module, and this file has to be one so that
// Vite's native config loader stops warning about it.
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20_000,
    // KAN-92: two projects, because the tests ask two different things of the
    // machine. `npm test` runs both.
    projects: [
      {
        extends: true,
        test: {
          name: "unit", // no database, no network: `npm run test:unit`
          include: ["tests/*.test.ts"],
          env: {
            // The mock reader's deliberate slowness is for the interface, not
            // for assertions. Without this the suite spends ~25 of its ~27
            // seconds sleeping. See src/server/extraction/mock-provider.ts.
            MOCK_EXTRACTION_DELAY_MS: "0",
            // The voice mock also has a short delay so KAN-89 can build a real
            // waiting state without making the contract suite wait for it.
            MOCK_VOICE_EXTRACTION_DELAY_MS: "0",
          },
        },
      },
      {
        extends: true,
        test: {
          name: "db", // real PostgreSQL; never skips: with nothing answering, the global setup throws
          include: ["tests/db/*.test.ts"],
          globalSetup: ["tests/db/support/global-setup.ts"],
          setupFiles: ["tests/db/support/setup.ts"],
          // A file holds up to 12 connections and PostgreSQL allows 100, shared with every other worktree: four files at once is 48.
          maxWorkers: 4,
          // Vitest refuses two projects with different caps in one group, so this one runs after the unit project.
          sequence: { groupOrder: 1 },
          env: {
            MOCK_EXTRACTION_DELAY_MS: "0",
            MOCK_VOICE_EXTRACTION_DELAY_MS: "0",
            // env() validates everything on its first call and these three have
            // no default. Storage itself is replaced by a fake.
            STORAGE_ENDPOINT: "http://storage.test:9000",
            STORAGE_ACCESS_KEY: "test",
            STORAGE_SECRET_KEY: "test",
          },
        },
      },
    ],
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
