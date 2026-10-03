# AGENTS.md

DayKeeper (Group 1): an AI-powered life management system for people in vulnerable groups. A user uploads a photo of a letter or document, the system reads it, and it becomes tasks and reminders. RMIT COSC2648 capstone project, P000473SE.

## Where things live

- [`docs/scope.md`](docs/scope.md): what this release builds, and what it deliberately does not. Where any other document describes behaviour that is not in it, that document is wrong.
- [`docs/start-here.md`](docs/start-here.md): how to run the whole thing, what the seed contains, and where everything lives. Read this first.
- [`docs/api.md`](docs/api.md): the API specification: every endpoint, what it takes and answers, and the reasoning for the parts that look arbitrary. Built; `/api-docs` in development is a Swagger page for trying each one, described in [`src/server/api/openapi.ts`](src/server/api/openapi.ts).
- [`docs/theme.md`](docs/theme.md): the theme. The palette, the contrast measurements, and the rules that make this product readable by the people it is for. Read it before styling a screen.
- [`docs/extraction.md`](docs/extraction.md): which model reads a letter, at which effort, with which prompt, and the experiment report each choice rests on. Newest decision on top. The code in `src/server/extraction/` changes only after this file does.
- [`docs/voice.md`](docs/voice.md): the proposed future-scope plan for Module 3. Milestone 1 prototypes transcript-to-commitment extraction with fixtures and no persistence; later milestones cover transcription, storage, tasks and recording. It does not change the current release boundary in `docs/scope.md`.
- [`docs/project-description.md`](docs/project-description.md): the official project description, verbatim. Our requirements baseline; when wording conflicts, this file wins on what the product is for, and [`docs/scope.md`](docs/scope.md) says which part of it we are building now.
- [`docs/prototype/user/daykeeper-sketch-live.html`](docs/prototype/user/daykeeper-sketch-live.html): clickable prototype of the user flow (phone). The live one; user-flow design work happens here, and its `:root` block is where the theme's palette lives. See "The look" below.
- [`.agents/skills/daykeeper-jira/`](.agents/skills/daykeeper-jira/): how this team's Jira board actually works, as a skill. Codex loads it when a ticket, the board or a sprint comes up; it needs the Atlassian MCP server, which [`.codex/config.toml`](.codex/config.toml) already defines and the README explains how to authenticate. Optional: nothing in the build depends on it.
- [`src/server/db/schema/`](src/server/db/schema/): the database, and its only definition: every table, column, constraint and index as Drizzle declarations, with the reason for each beside it. To change the database, edit a schema file, run `npm run db:generate -- --name=<what_changed>`, and commit the schema file together with the migration that command wrote under [`db/migrations/`](db/migrations/). Nobody edits a generated migration by hand, and the checks that run at commit and in CI say what to do when one is wrong. [`src/server/db/AGENTS.md`](src/server/db/AGENTS.md) has the rules, and the recipe for a new table, a new query and a new module.
- [`db/`](db/): what you run from a terminal: `reset.ts`, `migrate.ts` and `seed.ts`, and the generated migrations under `db/migrations/`. `db/lib/` holds what those scripts share: `connect.ts` reads the environment, finds the address and opens one connection, and has the first guard, `refuseIfNotLocal()`, which stops a script that destroys rows from running against a database that is not on this machine; `real-accounts.ts` is the second guard, `refuseIfRealAccounts()`, which asks the database itself whether it holds accounts nobody seeded; `admin.ts` drops everything, applies the migrations and empties every table; `seed-world.ts` is the seed's rows. There are three folders named db: `src/server/db/` is what the app imports, `db/` is what you run from a terminal, and [`tests/db/`](tests/db/) is the tests that need PostgreSQL. One rule tells the first two apart: if the app imports it, it lives under `src/server/db/`; if you run it from a terminal, it lives under `db/`.
- [`docs/deployment.md`](docs/deployment.md): the trial deployment (KAN-75), Netlify for the app and Supabase for the database and photographs, all under one project mailbox. How to deploy, every setting and why, what the free plans limit, and how to read the live state as an agent. The passwords and keys are not in it: they are in Teams, in the private channel Internal Documents of the team P000473SE-G1-DayKeeper, and "Where the keys are" in that file says exactly where, what is in them, and that an agent asks the person for a value rather than ever writing one down.

**Supabase will report "RLS disabled" on every table as critical. It does not apply here, and agents must not enable RLS or run the advisor's fix without asking.** The browser never talks to the database: the Data API is off, Supabase's API roles have no grants, and our own server enforces who sees what. [`docs/deployment.md`](docs/deployment.md), "Advisor warnings you will see", has the reasoning and the query that checks it.
- [`docs/walkthrough/`](docs/walkthrough/): **the way in**. A walk through the product one action at a time, and under each
  screen what the system does, which tables it writes, and why. Start here if you are new, or if you are
  about to change something and want to know what it is connected to. The PDF is built from the typst
  sources beside it; [`docs/walkthrough/README.md`](docs/walkthrough/README.md) says how to rebuild it and how the diagrams are made.
- [`experiments/`](experiments/): where a product decision was settled by measuring. One folder per question, with its raw results kept so the decision can be checked later. Each has its own `README.md` (the question) and `AGENTS.md` (how the code is arranged).
- [`src/lib/contract/`](src/lib/contract/): the agreement, in TypeScript, with validators: the six fields, the shapes the browser receives, the date rules and the reminder ladder. Import these types; do not restate them.
- [`src/server/`](src/server/): server-only code. `src/lib` is safe anywhere; `src/server` never reaches the browser.
  - [`db/`](src/server/db/): everything that knows about PostgreSQL, and the only folder under `src/` that imports Drizzle. `schema/` says what the tables are; `queries/` holds every statement the app runs, one file per family of tables, named like its schema file; `sql.ts` holds the few named SQL expressions the builder cannot say; `index.ts` is `db()`, the handle a query is run with. There is no hand-written SQL anywhere else under `src/`, and lint keeps it so.
  - The services: [`documents.ts`](src/server/documents.ts), [`tasks.ts`](src/server/tasks.ts), [`confirm.ts`](src/server/confirm.ts), [`field-views.ts`](src/server/field-views.ts), [`uploads/`](src/server/uploads/) (`intake.ts` is a letter arriving, `reading.ts` is a letter being read) and [`auth/`](src/server/auth/) (`session.ts` answers who is asking, `accounts.ts` registers and signs in). They hold the rules and turn rows into the shapes in `src/lib/contract/`. They call query functions and contain no SQL. Routes and pages call services, never the database.
  - [`storage.ts`](src/server/storage.ts) for the photographs themselves (an S3 bucket, MinIO locally), [`extraction/`](src/server/extraction/) for the reader interface, the Azure reader that runs the voting scheme, and the mock, `voice/` for the Module 3 prototype, `api/` for the response helpers and the Swagger description, and `env.ts` for the environment, checked once.
- [`src/server/ai/school-key.ts`](src/server/ai/school-key.ts): **the school's Azure key, and the one door in front of it.** Any module that calls a model on that key (letters today; voice and email as they arrive) takes its client from `schoolKeyClient()` and calls `spendSchoolKey("<module>")` before each request. The door enforces `AI_DAILY_CALL_LIMIT`, the site-wide daily ceiling that keeps the deployed site from burning the key (KAN-91). Building an `OpenAI` client with the key anywhere else walks round it. The letter reader in [`extraction/azure-provider.ts`](src/server/extraction/azure-provider.ts) is the worked example.
- [`src/app/`](src/app/): the interface, one page tree for phone and desktop, laid out from the phone prototype and given more room on a wide screen. Pages read the endpoints in [`docs/api.md`](docs/api.md) or call `src/server/` directly from server components; nothing reads fixture data.

## Conventions

- Everything in this repository is written in English.
- Say "photo upload", not "scan": the input is a phone photo of a document, per the project description's responsive web app framing.
- Commit messages in English, imperative mood. Do not add AI attribution or Co-Authored-By lines to commits.
- Branch names start with the Jira ticket key when there is one (`kan-13-photo-upload`): Jira attaches branches and pull requests to the ticket automatically when the key appears in the name, so the board stays wired to the code with no manual linking.
- Never commit secrets, API keys, or `.env` files. Personal API keys and personal paid cloud accounts are banned for this project.
- Large binaries and generated output stay out of git (see `.gitignore`); small curated fixtures are fine. The letter images under `data/` and videos under `docs/presentations/` go through Git LFS (`.gitattributes`); run `git lfs install` once per machine.

## One application, one language

The interface, the route handlers and the database access are one Next.js project in TypeScript, and they deploy as one thing.

The gain is in [`src/lib/contract/`](src/lib/contract/). Those types are the agreement between the browser and the server, and both sides import the same file, so a change to the shape of a response is a compile error on both sides at once rather than a message that arrives in the wrong shape at runtime. Anything the browser must never see is marked `server-only`, which turns a leak into a build error rather than a discovery.

One dependency set, one deployment, one test run, and one place to look when something is wrong. Four of the five of us have not shipped a web application before, and every one of those is worth more to a beginner than it is to an experienced team.

Extraction runs in route handlers, one round of the scheme per request: the upload answers immediately and reads the first round afterwards, and a round that decides nothing queues the next, which the next `GET /api/home` poll reads. One round per request because a round takes 10 to 25 seconds and Netlify, where the trial deployment runs, stops a request at 30, background work included (KAN-75). If a reading ever has to happen with nobody's screen open, that gets revisited and a real queue appears.

## The look

The theme is **Eucalypt & Wattle**, adopted 10 August 2026. **Read [`docs/theme.md`](docs/theme.md) before styling anything**: it has the palette, what each colour is for, the measured contrast of every pair, and the reasoning you would otherwise have to guess at.

The short version, so you know when to go and read it:

- The palette lives in [`src/app/globals.css`](src/app/globals.css), with shadcn's own names pointed at it. An ordinary `<Button>` is already eucalypt green; prefer `bg-primary`, `text-muted-foreground`, `border-border` and the DayKeeper additions (`text-warn` on `bg-warn-bg`, and so on) over typing a hex anywhere.
- [`docs/prototype/user/daykeeper-sketch-live.html`](docs/prototype/user/daykeeper-sketch-live.html) is the worked example. Open it in a browser to see what a screen is supposed to look like.
- Body text clears **7:1, not 4.5:1**, nothing is blue, nothing is pure white or pure black, gold is never text, and colour is never the only signal. Each of those has a reason involving eyes over 70, and [`docs/theme.md`](docs/theme.md) gives it.
- Type follows the prototype's own sizes, by name (`text-title`, `text-row`, `text-caption` and the rest in `src/app/globals.css`), and primary buttons are at least 48px tall. The pages not drawn from the prototype (sign in, register, settings, accessibility) keep Tailwind's ramp. [`docs/theme.md`](docs/theme.md), "Type", says why the earlier 18px floor went.

[`tests/theme.test.ts`](tests/theme.test.ts) holds the two copies of the palette (the prototype and [`docs/theme.md`](docs/theme.md)) against [`src/app/globals.css`](src/app/globals.css), which is where it lives, and fails the build if a colour drifts or a blue appears.

## Build and test

```bash
npm ci                    # installs exactly what package-lock.json says; never rewrites it
cp .env.example .env.local
docker compose up -d      # Postgres on 15432, MinIO on 19020; viewers on 8080 and 19021
npm run db:reset          # rebuild the database from db/migrations, empty the bucket, then seed both
npm run dev               # http://localhost:3000
npm test                  # every test; the database tests need the Postgres above
npm run test:unit         # only the tests that need no database
npm run db:generate -- --name=<what_changed>   # after editing src/server/db/schema: write the migration, then check and rehearse it
npm run db:regenerate -- --name=<what_changed> # throw this branch's migration away and write it again on top of main's
npm run db:migrate        # apply migrations you pulled, keeping your data (a database built before KAN-92 needs one db:reset first)
npm run db:check          # with no database: do the schema files and the migrations agree, and is main's history untouched?
npm run db:rehearse       # apply this branch's new migrations to a database built as main has it, with the seed's rows in it
npm run account:refresh-margaret               # empty Margaret and plant db/demo/margaret.json again, dated from today
npm run account:clear -- <someone>@example.com # empty one @example.com account; nobody else is touched
npm run typecheck
npm run build
npm run lint
```

Use `npm install <pkg>` only to intentionally change dependencies, and commit the resulting `package-lock.json` diff together with that change. If `git diff` shows lockfile churn and you did not change dependencies, revert it (`git checkout -- package-lock.json`). Node >=24 and npm >=11 are enforced through `engines` plus `.npmrc` engine-strict. Node 24 because it is the release line in active long-term support (Node 20 reached end of life on 30 April 2026, and 22 only receives security fixes), CI runs it, and a dependency needs a recent one anyway: `pdfjs-dist` asks for 22.13 or newer, and engine-strict makes any dependency's floor the whole install's floor.

Git hooks install themselves through `npm ci` (husky): staged files are formatted and linted at commit, commit messages are rejected if they carry AI attribution, and before a push the Git LFS files are uploaded and `typecheck` runs. The LFS step lives in `.husky/pre-push` because husky moves the hook directory away from where Git LFS installs its own; without it, pushes carry pointers and no images. Formatting is Prettier defaults (`.prettierrc`); prototypes and markdown are exempt (`.prettierignore`). Do not fight the hook output: if it reformatted a file, that is the file's correct shape.

Terminal output follows one rule: silence means success, anything printed is signal. When running scripts to read their output (as an AI agent does), prefer `npm run -s <script>`: it drops the three-line npm banner and nothing else. Do not set `loglevel=silent` anywhere permanent; it also swallows npm's own error reporting.

Tests are Vitest, in two projects. `tests/*.test.ts` need no database and no network (`npm run test:unit`); [`tests/contract.test.ts`](tests/contract.test.ts) checks that the agreement between the reader and everything else still holds. `tests/db/*.test.ts` run the real functions against a real PostgreSQL 17 and look at what ended up in the tables: each run builds its own databases, named `dk_test_...`, from `db/migrations`, beside yours, and drops them afterwards. They never skip: with Docker down, `npm test` fails and says to run `docker compose up -d`. To run one file: `npm run test:db -- tests/db/tasks.test.ts`.

Sign in with a seeded account (`margaret@example.com` or `operator@example.com`, password `daykeeper`; each teammate also has an empty one, printed by the seed); `npm run dev` then shows the interface over the seed's letters and tasks. The seed is for showing the product: three reminders due today and two ticked tasks, see [`docs/start-here.md`](docs/start-here.md). Uploading a letter runs the reader named by `AI_EXTRACTION_PROVIDER`: the mock by default, `azure` for the real reading that [`docs/extraction.md`](docs/extraction.md) describes.

Two rules that are easy to break by accident. Both are written where they are enforced, with the reasoning attached, so read them there rather than trusting a summary:

- **The six fields are a floor, not a ceiling**, and a field the reader could not read says so rather than going missing. [`src/lib/contract/fields.ts`](src/lib/contract/fields.ts) and [`src/lib/contract/extraction.ts`](src/lib/contract/extraction.ts).
- **The review screen shows, it never asks.** [`src/lib/contract/api.ts`](src/lib/contract/api.ts).

## Changing the database, and what the accounts hold

CI blocks agents, not people. Every database check is written for whoever is at the keyboard, which is usually a coding agent: when one goes red, at commit, in CI or after `db:generate`, its message says what is wrong and the commands that put it right. Run them and carry on.

**The structure** (tables, columns, constraints, indexes) changes in `src/server/db/schema/` and nowhere else. `npm run db:generate -- --name=<what_changed>` writes the migration and checks it; commit the schema file together with what it wrote. The pull request runs the same checks, and when it merges, the CD pipeline applies the migration to the deployed database before it deploys the code. A rename is three migrations, and a change to rows is a `--custom` migration: [`src/server/db/AGENTS.md`](src/server/db/AGENTS.md), "How the database changes".

**What an account holds** is changed by the Demo accounts button on the deployed site (GitHub, Actions, Demo accounts, Run workflow), and by `npm run account:clear` and `npm run account:refresh-margaret` on your own database. Each teammate's `@example.com` account is theirs: emptying your own is ordinary, and someone else's waits until they ask. Margaret belongs to the demonstration. What she holds is [`db/demo/margaret.json`](db/demo/margaret.json), which Jason reviews, and anyone may refresh her before a demonstration. `operator@example.com` is left as it is. [`docs/deployment.md`](docs/deployment.md), "Changing what an account holds".

**The one line not to cross: nothing run from a laptop changes the deployed database.** Its structure changes only through the pipeline, so every database has had the same migrations in the same order; its accounts only through the button, so every change is on record where the whole team can see it. When something there needs a change neither of them can make, stop and ask Jason.

## Worktrees: parallel agents without collisions

One shared docker stack serves every checkout. Each worktree owns its own **database** (inside the one Postgres), its own **bucket** (inside the one MinIO) and its own **dev port**, all derived deterministically from its branch name, so any number of agents can build, seed, reset and serve side by side without touching each other. `db:reset` in a worktree nukes only that worktree's database and bucket.

### Dispatching parallel worktrees (you are in the main checkout)

When asked to parallelise work across worktrees:

1. Create each one as `git worktree add ../daykeeper-worktrees/<slug> -b <branch>` — a sibling container directory, so checkouts never end up inside each other or inside tool scans.
2. Hand each worktree to one agent whose working directory is **inside** it; this file loads there and the next section tells it everything it needs. If it needs a hint, one sentence suffices: "start with `npm run worktree:setup`".
3. Split the work so that no two worktrees edit the same files. Ports and databases are isolated by the scripts; merge conflicts are prevented only by how you split the work.
4. When a worktree's work is merged (or abandoned): inside it, `npm run worktree:teardown` (drops its database, frees its port), then from the main checkout `git worktree remove ../daykeeper-worktrees/<slug>`, and delete its branch once merged (`git branch -d`) or abandoned (`-D`).

### Working in a worktree (you woke up inside one)

```bash
npm run worktree:setup   # derives this worktree's database + bucket + port, writes .env.local, creates the DB
npm ci                   # once per worktree
npm run db:reset         # migrations + seed + bucket, all THIS worktree's own
npm run dev              # serves on the port setup printed (it is in .env.local)
```

The main checkout keeps the shared defaults (database `daykeeper`, port 3000); `worktree:setup` refuses to run there. Everything in [`docs/start-here.md`](docs/start-here.md) applies unchanged otherwise.

**Environment problems wear a code-bug mask.** Check the environment before touching code:

| what you see | what it usually is | the fix |
|---|---|---|
| `ECONNREFUSED` / timeout at the database or at storage | docker is down, or `.env.local` was never written | `docker compose up -d`, then `npm run worktree:setup` |
| `EADDRINUSE` | a stale process on this worktree's own port | `npm run dev` clears its own port first; just rerun it |
| `Cannot find module ...` | dependencies not installed here | `npm ci` |
| `column ... does not exist` or `relation ... does not exist` | you pulled a migration that this database has not had yet | `npm run db:migrate` (keeps your data), or `npm run db:reset` for a clean start. A local database built before KAN-92 has no record of applied migrations, so it needs one `npm run db:reset` before `db:migrate` can ever work |

**Never edit application source or configuration to dodge an environment problem** — changing a port in code, pointing at a different database, weakening a check. If the environment blocks you, the fix is one of the commands above; if none of them fixes it, say so plainly instead of working around it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
