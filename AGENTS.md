# AGENTS.md

DayKeeper (Group 1): an AI-powered life management system for people in vulnerable groups. A user uploads a photo of a letter or document, the system reads it, and it becomes tasks and reminders. RMIT COSC2648 capstone project, P000473SE.

## Where things live

- `docs/start-here.md`: how to run the whole thing, what the seed contains, and where everything lives. Read this first.
- `docs/api.md`: the API specification. **Not built yet**: this is the shape to build against, with the reasoning for the parts that look arbitrary.
- `docs/architecture/adr-00*.md`: the four decisions that shape the rest (one Next.js app, our own auth behind one function, plain Postgres with no migrations, the six-field extraction contract). When something looks odd, the reason is in one of these.
- `docs/project-description.md`: the official project description, verbatim. Our requirements baseline; when wording conflicts, this file wins.
- `docs/DayKeeper-Tech-Stack-Recommendation.md`: the tech stack recommendation (draft until the team adopts it).
- `docs/Technical-Research-and-Implementation-Roadmap.md`: step-by-step research and build plan; check this before starting new feature work.
- `docs/prototype/user/daykeeper-sketch-live.html`: clickable prototype of the user flow (phone). The live one; this is where user-flow design work happens.
- `docs/prototype/admin/daykeeper-admin-sketch.html`: wireframe of the admin dashboard (desktop). Static, no interaction. Keep the two prototypes separate: different device, different person, different module.
- `docs/ai-prompts/`: AI usage records for the course GenAI declaration (create on first use). If AI helped with a change, log it there.
- `db/schema.sql`: the database, and its only definition. No migrations: edit it and run `npm run db:reset`.
- `src/lib/contract/`: the six-field extraction contract in TypeScript, with a validator. Import these types; do not restate them.
- `src/server/`: server-only code. `db.ts` for queries, `extraction/` for the reader interface and its mock. `src/lib` is safe anywhere; `src/server` never reaches the browser.
- `src/app/`: the interface. The pages still read from `src/lib/mock-data.ts`; wiring them to real endpoints is the work.

## Conventions

- Everything in this repository is written in English.
- Say "photo upload", not "scan": the input is a phone photo of a document, per the project description's responsive web app framing.
- Commit messages in English, imperative mood. Do not add AI attribution or Co-Authored-By lines to commits.
- Never commit secrets, API keys, or `.env` files. Personal API keys and personal paid cloud accounts are banned for this project.
- Large binaries and generated output stay out of git (see `.gitignore`); small curated fixtures are fine.

## Build and test

```bash
npm ci                    # installs exactly what package-lock.json says; never rewrites it
cp .env.example .env.local
docker compose up -d      # Postgres on 55432; a database viewer on 8080
npm run db:reset          # rebuild the schema from db/schema.sql, then seed
npm run dev               # http://localhost:3000
npm test                  # the contract tests
npm run typecheck
npm run build
npm run lint
```

Use `npm install <pkg>` only to intentionally change dependencies, and commit the resulting `package-lock.json` diff together with that change. If `git diff` shows lockfile churn and you did not change dependencies, revert it (`git checkout -- package-lock.json`). Node >=20.17 and npm >=11 are enforced through `engines` plus `.npmrc` engine-strict.

Git hooks install themselves through `npm ci` (husky): staged files are formatted and linted at commit, commit messages are rejected if they carry AI attribution, and `typecheck` runs before a push. Formatting is Prettier defaults (`.prettierrc`); prototypes and markdown are exempt (`.prettierignore`). Do not fight the hook output: if it reformatted a file, that is the file's correct shape.

Terminal output follows one rule: silence means success, anything printed is signal. When running scripts to read their output (as an AI agent does), prefer `npm run -s <script>`: it drops the three-line npm banner and nothing else. Do not set `loglevel=silent` anywhere permanent; it also swallows npm's own error reporting.

Tests are Vitest, in `tests/`. `tests/contract.test.ts` needs no database and no network: it checks that the agreement between the reader and everything else still holds.

The pages have no working sign-in yet and read `src/lib/mock-data.ts`, so `npm run dev` shows the interface with fixture data. The seeded accounts (`margaret@example.com` and `operator@example.com`, password `daykeeper`) are already in the database and will work once somebody builds authentication.

Two rules that are easy to break by accident:

- **The six fields are a floor, not a ceiling.** A reader may return more, and the extra is kept in `open_payload`. But all six must be present, and a field that could not be read says `unreadable` rather than being omitted. `summary` is deliberately not one of them; see ADR 004.
- **Never drop `rawText` from the review screen.** Showing the snippet the value came from is what turns confirming into checking. Without it the product's central safety claim is theatre.

## Worktrees: parallel agents without collisions

One shared docker stack serves every checkout. Each worktree owns its own **database** (inside the one Postgres) and its own **dev port**, both derived deterministically from its branch name, so any number of agents can build, seed, reset and serve side by side without touching each other. `db:reset` in a worktree nukes only that worktree's database.

### Dispatching parallel worktrees (you are in the main checkout)

When asked to parallelise work across worktrees:

1. Create each one as `git worktree add ../daykeeper-worktrees/<slug> -b <branch>` — a sibling container directory, so checkouts never end up inside each other or inside tool scans.
2. Hand each worktree to one agent whose working directory is **inside** it; this file loads there and the next section tells it everything it needs. If it needs a hint, one sentence suffices: "start with `npm run worktree:setup`".
3. Split the work so that no two worktrees edit the same files. Ports and databases are isolated by the scripts; merge conflicts are prevented only by how you split the work.
4. When a worktree's work is merged (or abandoned): inside it, `npm run worktree:teardown` (drops its database, frees its port), then from the main checkout `git worktree remove ../daykeeper-worktrees/<slug>`, and delete its branch once merged (`git branch -d`) or abandoned (`-D`).

### Working in a worktree (you woke up inside one)

```bash
npm run worktree:setup   # derives this worktree's database + port, writes .env.local, creates the DB
npm ci                   # once per worktree
npm run db:reset         # schema + seed, into THIS worktree's database
npm run dev              # serves on the port setup printed (it is in .env.local)
```

The main checkout keeps the shared defaults (database `daykeeper`, port 3000); `worktree:setup` refuses to run there. Everything in `docs/start-here.md` applies unchanged otherwise.

**Environment problems wear a code-bug mask.** Check the environment before touching code:

| what you see | what it usually is | the fix |
|---|---|---|
| `ECONNREFUSED` / timeout at the database | docker is down, or `.env.local` was never written | `docker compose up -d`, then `npm run worktree:setup` |
| `EADDRINUSE` | a stale process on this worktree's own port | `npm run dev` clears its own port first; just rerun it |
| `Cannot find module ...` | dependencies not installed here | `npm ci` |

**Never edit application source or configuration to dodge an environment problem** — changing a port in code, pointing at a different database, weakening a check. If the environment blocks you, the fix is one of the commands above; if none of them fixes it, say so plainly instead of working around it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
