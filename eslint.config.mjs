import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * KAN-92: the import fence round the database folder.
 *
 * src/server/db is the only folder that knows PostgreSQL. What it asks of the
 * code around it, and of its own files, is written in src/server/db/AGENTS.md
 * with the reason for each rule. The rules a linter can check are checked
 * here, so that breaking one is an error with a sentence saying where the
 * thing belongs instead, and not something a reviewer has to notice.
 *
 * Every block is scoped to files under src/. The scripts in db/ and scripts/,
 * the tests and drizzle.config.ts stay outside the fence: they run from a
 * terminal, and they are allowed to speak to the database directly.
 *
 * In flat config a later block replaces an earlier block's options for the
 * same rule; the two lists are not added together. So no block is written out
 * by hand. Each one is built by fence() from every ban that applies to its
 * files, and the blocks run from the widest to the narrowest, so the last
 * block that matches a file carries everything that applies to it.
 */

/**
 * One ban: the sentence that says where the thing belongs instead, and the
 * imports it is about. A name is matched exactly. A name ending in `/*` is
 * everything under that path, however deep. `only` narrows the ban to those
 * imported names, and every other name from the same module stays allowed.
 */
function ban(message, names, only) {
  const exact = names.filter((name) => !name.endsWith("/*"));
  const under = names.filter((name) => name.endsWith("/*"));
  const narrowed = only ? { importNames: only } : {};
  return {
    paths: exact.map((name) => ({ name, message, ...narrowed })),
    patterns: under.length > 0 ? [{ group: under, message, ...narrowed }] : [],
  };
}

/** One block of the fence: these files, held to all of these bans. */
function fence(files, bans, ignores) {
  return {
    files,
    ...(ignores && { ignores }),
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: bans.flatMap((each) => each.paths),
          patterns: bans.flatMap((each) => each.patterns),
        },
      ],
    },
  };
}

// Everything outside src/server/db. Drizzle, the driver, the table
// declarations, the pool and the SQL helpers are the inside of that folder.
// What it offers the rest of the app is `db()`, the query functions and the
// two functions of errors.ts.
const drizzleStaysInside = ban(
  "Only src/server/db speaks Drizzle: add a function to src/server/db/queries/ and call it.",
  [
    "drizzle-orm",
    "drizzle-orm/*",
    "pg",
    "pg/*",
    "@/server/db/schema",
    "@/server/db/schema/*",
    "@/server/db/client",
    "@/server/db/sql",
  ],
);

// Pages, routes and components. A rule that lives in a service is applied
// whoever asks; a page that ran its own statement would walk round it.
const servicesStandInFront = ban(
  "Pages, routes and components never reach the database: call a service in src/server (documents.ts, tasks.ts, uploads/, auth/), and put a new rule there.",
  ["@/server/db", "@/server/db/*"],
);

// src/lib is imported by client components, so anything it imported from
// src/server would be on its way to the browser. Everything under
// @/server/db is under @/server, so this ban contains the one above and
// src/lib is given this one alone.
const libIsSafeAnywhere = ban(
  "src/lib is safe anywhere, the browser included, and src/server never reaches the browser: move the code that needs the server into src/server.",
  ["@/server", "@/server/*"],
);

// Inside src/server/db: SQL text is written in sql.ts and in schema/, and
// nowhere else. Banning the `sql` tag is what keeps a statement from being
// typed out by hand in a queries file.
const sqlTextHasOneHome = ban(
  "SQL text lives in src/server/db/sql.ts: add a named helper there, with the reason the builder cannot say it, and import the name.",
  ["drizzle-orm", "drizzle-orm/*"],
  ["sql"],
);

// A query function is handed the handle. One that fetched the app's own could
// not run inside a transaction, where the handle is the `tx`.
const handleIsPassedIn = ban(
  "A query function takes the handle as its first parameter (db: Db, from ../client) and never imports the app's own: the caller passes db(), or the tx of its transaction.",
  ["@/server/db", "../index", ".."],
);

// drizzle-kit, the scripts in db/ and Vitest load the script-safe files
// outside Next.js, where `server-only` throws, and the app's handle (index.ts)
// imports `server-only` and src/server/env.ts. `index` is the handle's path as
// these files would write it: ../index from schema/, ./index from beside it.
const scriptSafe = (index) =>
  ban(
    "This file is script-safe: drizzle-kit, the scripts in db/ and Vitest load it outside Next.js, where server-only throws. Take the connection string or the handle as a parameter instead.",
    ["server-only", "@/server/env", "@/server/db", ...index],
  );

const databaseFence = [
  fence(["src/**"], [drizzleStaysInside], ["src/server/db/**"]),
  fence(
    ["src/app/**", "src/components/**"],
    [drizzleStaysInside, servicesStandInFront],
  ),
  fence(["src/lib/**"], [drizzleStaysInside, libIsSafeAnywhere]),
  fence(
    ["src/server/db/**"],
    [sqlTextHasOneHome],
    ["src/server/db/sql.ts", "src/server/db/schema/**"],
  ),
  fence(["src/server/db/queries/**"], [sqlTextHasOneHome, handleIsPassedIn]),
  fence(["src/server/db/schema/**"], [scriptSafe(["../index", ".."])]),
  fence(
    ["src/server/db/client.ts", "src/server/db/errors.ts"],
    [sqlTextHasOneHome, scriptSafe(["./index", "."])],
  ),
  {
    files: ["src/server/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='prepare']",
          message:
            "Never .prepare(): Drizzle names a statement only when it is prepared, and the Supabase transaction pooler has no named prepared statements. Run the builder as it is.",
        },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...databaseFence,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // What `netlify deploy` builds locally before uploading it. Generated.
    ".netlify/**",
    // main's files, unpacked while `npm run db:rehearse` runs and removed when
    // it ends. If a run was interrupted, they are still not this branch's code.
    ".rehearse/**",
  ]),
]);

export default eslintConfig;
