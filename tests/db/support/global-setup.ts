// KAN-92: once per run of the database tests: find PostgreSQL, and build the template every test file copies.

/**
 * The database tests run the real functions against a real PostgreSQL 17: the
 * container `docker compose up -d` starts on a laptop, a service container in
 * CI. This file runs once, before any test file, and does three things.
 *
 * It refuses to go on without a database. A database test that skips itself
 * when nothing answers passes on every machine where it proves nothing, so
 * this throws instead, with the command that fixes it.
 *
 * It builds the template: an empty database, emptied and then built by the
 * same two functions `npm run db:reset` uses. Every run therefore proves that
 * the migrations under db/migrations build a database from nothing.
 *
 * And it hands the template's name to the test files (./setup.ts), each of
 * which copies it into a database of its own.
 *
 * The database in DATABASE_URL is only where CREATE DATABASE and DROP DATABASE
 * are sent from. Nothing in it is read or written.
 */

import { config } from "dotenv";
import { sql } from "drizzle-orm";
import type { TestProject } from "vitest/node";

import { applyMigrations, dropEverything } from "../../../db/lib/admin";
import { hostIsLocal } from "@/lib/local-host";
import { createDb } from "@/server/db/client";
import { dbCause } from "@/server/db/errors";
import {
  createEmpty,
  dropRun,
  dropStale,
  newRunId,
  prefixFor,
  templateName,
  withDatabase,
} from "./databases";

declare module "vitest" {
  export interface ProvidedContext {
    /** The configured database: where a test file sends its own CREATE and DROP DATABASE from. */
    dkTestAdminUrl: string;
    /** The database this run built from db/migrations, which every test file copies. */
    dkTestTemplate: string;
  }
}

/**
 * DATABASE_URL as a developer's .env.local has it, or as CI sets it.
 *
 * The two files are read into an object of their own rather than into
 * process.env. The test workers inherit this process's environment, and a
 * developer's reader choice or daily call limit must not come with it and
 * change what a test does.
 */
function configuredUrl(): string {
  const fromFiles: Record<string, string> = {};
  config({ path: [".env.local", ".env"], processEnv: fromFiles, quiet: true });

  const url = process.env.DATABASE_URL ?? fromFiles.DATABASE_URL;
  if (!url) {
    throw new Error(
      "The database tests need DATABASE_URL. Copy .env.example to .env.local first.",
    );
  }
  return url;
}

export default async function setup(project: TestProject) {
  const url = configuredUrl();

  // The same guard as db/reset.ts, with no way round it: these tests create
  // and drop databases, and nothing they prove needs a server anywhere else.
  if (!hostIsLocal(url)) {
    throw new Error(
      "The database tests only run against a database on this machine, and DATABASE_URL names another host or cannot be read as an address.",
    );
  }
  const host = new URL(url).host;

  const admin = createDb(url, { max: 1 });
  try {
    await admin.db.execute(sql`SELECT 1`);
  } catch (error) {
    await admin.pool.end();

    // PostgreSQL answering "no" (a database that does not exist, a wrong
    // password) is a different problem from nothing answering, and the fix
    // for one is no help with the other. Its own errors carry a severity.
    const cause = dbCause(error);
    if (typeof (cause as { severity?: unknown }).severity === "string") {
      throw new Error(
        `The database tests reached PostgreSQL at ${host} and it refused DATABASE_URL: ${(cause as Error).message}. ` +
          "Check DATABASE_URL in .env.local; in a worktree, npm run worktree:setup writes it and creates the database.",
      );
    }
    throw new Error(
      `The database tests need PostgreSQL and nothing answered at ${host}. ` +
        "Start it with: docker compose up -d. " +
        "To run only the tests that need no database: npm run test:unit",
    );
  }

  const prefix = prefixFor(url);
  const runId = newRunId();
  const template = templateName(prefix, runId);

  try {
    await dropStale(admin.db, prefix);
    await createEmpty(admin.db, template);

    // Emptied and built the way `npm run db:reset` does it. The connection is
    // closed before anything copies the template, because PostgreSQL will not
    // copy a database somebody is connected to.
    const building = createDb(withDatabase(url, template), { max: 1 });
    try {
      await dropEverything(building.db);
      await applyMigrations(building.db);
    } finally {
      await building.pool.end();
    }
  } catch (error) {
    await dropRun(admin.db, prefix, runId).catch(() => {});
    await admin.pool.end();
    throw error;
  }

  project.provide("dkTestAdminUrl", url);
  project.provide("dkTestTemplate", template);

  return async () => {
    try {
      await dropRun(admin.db, prefix, runId);
    } finally {
      await admin.pool.end();
    }
  };
}
