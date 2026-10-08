// KAN-92: the database, declared in TypeScript; drizzle.config.ts points here.

/**
 * The database.
 *
 * Every table, column, constraint and index is declared in the files beside
 * this one, one file per family of tables, each with the reason it exists
 * written next to it. The migrations under db/migrations are generated from
 * these files (`npm run db:generate`) and are never written by hand.
 *
 * Plain PostgreSQL. No vendor-specific extension and no reference to a hosted
 * provider's auth schema, so the same migrations run against the local Docker
 * container or against any managed Postgres. Keep it that way.
 *
 * The photographs are not in here. These tables hold a key; the bytes are
 * objects in a bucket, reached only through src/server/storage.ts. `db:reset`
 * empties that bucket in the same breath as it drops these tables, because
 * rows and objects drifting out of step is how "it works on my machine"
 * starts.
 *
 * What this release builds, and what it deliberately leaves out: docs/scope.md.
 *
 * Every foreign key, unique constraint, check and index carries a name,
 * written out, and none of them may change. The foreign keys carry the name
 * PostgreSQL gives one by default, and so do two unique constraints,
 * `sessions_token_hash_key` and `reminders_task_id_remind_on_key`; every
 * other name was chosen. (A primary key is left to PostgreSQL, which calls it
 * `<table>_pkey` whoever asks.) The databases that exist were built with
 * these names, so a different name here, which is what Drizzle would choose
 * for one left unnamed, becomes a migration that renames a constraint and
 * changes nothing else.
 *
 * Script-safe, like every file in this folder: no `server-only`, nothing from
 * src/server/env.ts and nothing else under src/server. drizzle-kit, the
 * scripts in db/ and Vitest load these files outside Next.js, where
 * `server-only` throws. Pure modules under src/lib/contract are fine.
 *
 * A new family of tables is a new file beside these and one line below.
 */

export * from "./enums";
export * from "./users";
export * from "./documents";
export * from "./readings";
export * from "./tasks";
export * from "./audit";
export * from "./email";
