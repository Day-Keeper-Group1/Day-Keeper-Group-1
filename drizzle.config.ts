import { defineConfig } from "drizzle-kit";

// KAN-92: only `generate` is ever run through drizzle-kit, and it needs no
// database, so there are no credentials here: push, migrate and studio cannot
// be pointed at anything by accident. Migrations are applied by db/migrate.ts.
export default defineConfig({
  dialect: "postgresql",
  // The barrel file, not the folder: the folder would load every table twice
  // and fail with "duplicated view name".
  schema: "./src/server/db/schema/index.ts",
  out: "./db/migrations",
});
