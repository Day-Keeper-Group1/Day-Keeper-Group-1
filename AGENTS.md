# AGENTS.md

DayKeeper (Group 1): an AI-powered life management system for people in vulnerable groups. A user uploads a photo of a letter or document, the system reads it, and it becomes tasks and reminders. RMIT COSC2648 capstone project, P000473SE.

## Where things live

- [`docs/scope.md`](docs/scope.md): what this release builds, and what it deliberately does not. Where any other document describes behaviour that is not in it, that document is wrong.
- [`docs/start-here.md`](docs/start-here.md): how to run the whole thing, what the seed contains, and where everything lives. Read this first.
- [`docs/api.md`](docs/api.md): the API specification: every endpoint, what it takes and answers, and the reasoning for the parts that look arbitrary. Built; `/api-docs` in development is a Swagger page for trying each one, described in [`src/server/api/openapi.ts`](src/server/api/openapi.ts).
- [`docs/theme.md`](docs/theme.md): the theme. The palette, the contrast measurements, and the rules that make this product readable by the people it is for. Read it before styling a screen.
- [`docs/extraction.md`](docs/extraction.md): which model reads a letter, at which effort, with which prompt, and the experiment report each choice rests on. Newest decision on top. The code in `src/server/extraction/` changes only after this file does.
- [`docs/project-description.md`](docs/project-description.md): the official project description, verbatim. Our requirements baseline; when wording conflicts, this file wins on what the product is for, and [`docs/scope.md`](docs/scope.md) says which part of it we are building now.
- [`docs/prototype/user/daykeeper-sketch-live.html`](docs/prototype/user/daykeeper-sketch-live.html): clickable prototype of the user flow (phone). The live one; user-flow design work happens here, and its `:root` block is where the theme's palette lives. See "The look" below.
- [`.agents/skills/daykeeper-jira/`](.agents/skills/daykeeper-jira/): how this team's Jira board actually works, as a skill. Codex loads it when a ticket, the board or a sprint comes up; it needs the Atlassian MCP server, which [`.codex/config.toml`](.codex/config.toml) already defines and the README explains how to authenticate. Optional: nothing in the build depends on it.
- [`db/schema.sql`](db/schema.sql): the database, and its only definition. No migrations: edit it and run `npm run db:reset`.
- [`docs/deployment.md`](docs/deployment.md): the trial deployment (KAN-75), Netlify for the app and Supabase for the database and photographs, all under one project mailbox. How to deploy, every setting and why, what the free plans limit, and how to read the live state as an agent. The passwords and keys are not in it; they are in the team's Teams channel.

**Supabase will report "RLS disabled" on every table as critical. It does not apply here, and agents must not enable RLS or run the advisor's fix without asking.** The browser never talks to the database: the Data API is off, Supabase's API roles have no grants, and our own server enforces who sees what. [`docs/deployment.md`](docs/deployment.md), "Advisor warnings you will see", has the reasoning and the query that checks it.
- [`docs/walkthrough/`](docs/walkthrough/): **the way in**. A walk through the product one action at a time, and under each
  screen what the system does, which tables it writes, and why. Start here if you are new, or if you are
  about to change something and want to know what it is connected to. The PDF is built from the typst
  sources beside it; [`docs/walkthrough/README.md`](docs/walkthrough/README.md) says how to rebuild it and how the diagrams are made.
- [`experiments/`](experiments/): where a product decision was settled by measuring. One folder per question, with its raw results kept so the decision can be checked later. Each has its own `README.md` (the question) and `AGENTS.md` (how the code is arranged).
- [`src/lib/contract/`](src/lib/contract/): the agreement, in TypeScript, with validators: the six fields, the shapes the browser receives, the date rules and the reminder ladder. Import these types; do not restate them.
- [`src/server/`](src/server/): server-only code. [`db.ts`](src/server/db.ts) for queries, [`storage.ts`](src/server/storage.ts) for the photographs themselves (an S3 bucket, MinIO locally), [`extraction/`](src/server/extraction/) for the reader interface, the Azure reader that runs the voting scheme, and the mock. `src/lib` is safe anywhere; `src/server` never reaches the browser.
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
npm run db:reset          # rebuild the schema from db/schema.sql, empty the bucket, then seed both
npm run dev               # http://localhost:3000
npm test                  # the contract tests
npm run typecheck
npm run build
npm run lint
```

Use `npm install <pkg>` only to intentionally change dependencies, and commit the resulting `package-lock.json` diff together with that change. If `git diff` shows lockfile churn and you did not change dependencies, revert it (`git checkout -- package-lock.json`). Node >=20.17 and npm >=11 are enforced through `engines` plus `.npmrc` engine-strict.

Git hooks install themselves through `npm ci` (husky): staged files are formatted and linted at commit, commit messages are rejected if they carry AI attribution, and before a push the Git LFS files are uploaded and `typecheck` runs. The LFS step lives in `.husky/pre-push` because husky moves the hook directory away from where Git LFS installs its own; without it, pushes carry pointers and no images. Formatting is Prettier defaults (`.prettierrc`); prototypes and markdown are exempt (`.prettierignore`). Do not fight the hook output: if it reformatted a file, that is the file's correct shape.

Terminal output follows one rule: silence means success, anything printed is signal. When running scripts to read their output (as an AI agent does), prefer `npm run -s <script>`: it drops the three-line npm banner and nothing else. Do not set `loglevel=silent` anywhere permanent; it also swallows npm's own error reporting.

Tests are Vitest, in `tests/`. [`tests/contract.test.ts`](tests/contract.test.ts) needs no database and no network: it checks that the agreement between the reader and everything else still holds.

Sign in with a seeded account (`margaret@example.com` or `operator@example.com`, password `daykeeper`; each teammate also has an empty one, printed by the seed); `npm run dev` then shows the interface over the seed's letters and tasks. The seed is for showing the product: three reminders due today and two ticked tasks, see [`docs/start-here.md`](docs/start-here.md). Uploading a letter runs the reader named by `AI_EXTRACTION_PROVIDER`: the mock by default, `azure` for the real reading that [`docs/extraction.md`](docs/extraction.md) describes.

Two rules that are easy to break by accident. Both are written where they are enforced, with the reasoning attached, so read them there rather than trusting a summary:

- **The six fields are a floor, not a ceiling**, and a field the reader could not read says so rather than going missing. [`src/lib/contract/fields.ts`](src/lib/contract/fields.ts) and [`src/lib/contract/extraction.ts`](src/lib/contract/extraction.ts).
- **The review screen shows, it never asks.** [`src/lib/contract/api.ts`](src/lib/contract/api.ts).

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
npm run db:reset         # schema + seed + bucket, all THIS worktree's own
npm run dev              # serves on the port setup printed (it is in .env.local)
```

The main checkout keeps the shared defaults (database `daykeeper`, port 3000); `worktree:setup` refuses to run there. Everything in [`docs/start-here.md`](docs/start-here.md) applies unchanged otherwise.

**Environment problems wear a code-bug mask.** Check the environment before touching code:

| what you see | what it usually is | the fix |
|---|---|---|
| `ECONNREFUSED` / timeout at the database or at storage | docker is down, or `.env.local` was never written | `docker compose up -d`, then `npm run worktree:setup` |
| `EADDRINUSE` | a stale process on this worktree's own port | `npm run dev` clears its own port first; just rerun it |
| `Cannot find module ...` | dependencies not installed here | `npm ci` |
| `column ... does not exist` or `relation ... does not exist` | this database was built from an older `db/schema.sql`: you pulled a schema change, and there are no migrations to bring it along | `npm run db:reset` |

**Never edit application source or configuration to dodge an environment problem** — changing a port in code, pointing at a different database, weakening a check. If the environment blocks you, the fix is one of the commands above; if none of them fixes it, say so plainly instead of working around it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
