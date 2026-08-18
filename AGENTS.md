# AGENTS.md

DayKeeper (Group 1): an AI-powered life management system for people in vulnerable groups. A user uploads a photo of a letter or document, the system reads it, and it becomes tasks and reminders. RMIT COSC2648 capstone project, P000473SE.

## Where things live

- `docs/start-here.md`: how to run the whole thing, what the seed contains, and where everything lives. Read this first.
- `docs/api.md`: the API specification. **Not built yet**: this is the shape to build against, with the reasoning for the parts that look arbitrary.
- `docs/theme.md`: the theme. The palette, the contrast measurements, and the rules that make this product readable by the people it is for. Read it before styling a screen.
- `docs/architecture/adr-00*.md`: the decisions that shape the rest (one Next.js app, our own auth behind one function, plain Postgres and an S3 bucket, the six-field extraction contract, the grouping manifest, model-driven matching, and the tick as a task's only state). When something looks odd, the reason is in one of these.
- `docs/project-description.md`: the official project description, verbatim. Our requirements baseline; when wording conflicts, this file wins.
- `docs/DayKeeper-Tech-Stack-Recommendation.md`: the tech stack recommendation, corrected 18 August 2026 to match ADRs 001-008. Where it and an ADR disagree, the ADR wins.
- `docs/Technical-Research-and-Implementation-Roadmap.md`: step-by-step research and build plan, corrected 18 August 2026 to match ADRs 001-008; check this before starting new feature work.
- `docs/prototype/user/daykeeper-sketch-live.html`: clickable prototype of the user flow (phone). The live one; user-flow design work happens here, and its `:root` block is where the theme's palette lives. See "The look" below.
- `docs/prototype/admin/daykeeper-admin-sketch.html`: wireframe of the admin dashboard (desktop). Static, no interaction. Keep the two prototypes separate: different device, different person, different module.
- `.agents/skills/daykeeper-jira/`: how this team's Jira board actually works, as a skill. Codex loads it when a ticket, the board or a sprint comes up; it needs the Atlassian MCP server, which `.codex/config.toml` already defines and the README explains how to authenticate. Optional: nothing in the build depends on it.
- `db/schema.sql`: the database, and its only definition. No migrations: edit it and run `npm run db:reset`.
- `docs/schema-map.html`: the same fourteen tables as a picture, with a letter's five steps along the top and a badge on each table saying which step writes it. Open it in a browser when you want to see the shape; read `db/schema.sql` when you need the truth.
- `src/lib/contract/`: the six-field extraction contract and the grouping manifest (how a pile of photographs becomes letters), in TypeScript, with validators. Import these types; do not restate them.
- `src/server/`: server-only code. `db.ts` for queries, `storage.ts` for the photographs themselves (an S3 bucket, MinIO locally), `extraction/` for the reader interface and its mock. `src/lib` is safe anywhere; `src/server` never reaches the browser.
- `src/app/`: the interface. The pages still read from `src/lib/mock-data.ts`; wiring them to real endpoints is the work.

## Conventions

- Everything in this repository is written in English.
- Say "photo upload", not "scan": the input is a phone photo of a document, per the project description's responsive web app framing.
- Commit messages in English, imperative mood. Do not add AI attribution or Co-Authored-By lines to commits.
- Branch names start with the Jira ticket key when there is one (`kan-13-photo-upload`): Jira attaches branches and pull requests to the ticket automatically when the key appears in the name, so the board stays wired to the code with no manual linking.
- Never commit secrets, API keys, or `.env` files. Personal API keys and personal paid cloud accounts are banned for this project.
- Large binaries and generated output stay out of git (see `.gitignore`); small curated fixtures are fine.

## The look

The theme is **Eucalypt & Wattle**, adopted 10 August 2026. **Read [`docs/theme.md`](docs/theme.md) before styling anything**: it has the palette, what each colour is for, the measured contrast of every pair, and the reasoning you would otherwise have to guess at.

The short version, so you know when to go and read it:

- The palette lives in `src/app/globals.css`, with shadcn's own names pointed at it. An ordinary `<Button>` is already eucalypt green; prefer `bg-primary`, `text-muted-foreground`, `border-border` and the DayKeeper additions (`text-warn` on `bg-warn-bg`, and so on) over typing a hex anywhere.
- `docs/prototype/user/daykeeper-sketch-live.html` is the worked example. Open it in a browser to see what a screen is supposed to look like.
- Body text clears **7:1, not 4.5:1**, nothing is blue, nothing is pure white or pure black, gold is never text, and colour is never the only signal. Each of those has a reason involving eyes over 70, and `docs/theme.md` gives it.
- Body text is at least 18px and primary buttons at least 48px tall. The prototype's own type is still the older smaller scale, so build new screens at the larger size rather than matching the sketch.

`tests/theme.test.ts` keeps the three copies of the palette (the stylesheet, the prototype, the doc) in agreement, and fails the build if a colour drifts or a blue appears.

## Build and test

```bash
npm ci                    # installs exactly what package-lock.json says; never rewrites it
cp .env.example .env.local
docker compose up -d      # Postgres on 55432, MinIO on 59000; viewers on 8080 and 59001
npm run db:reset          # rebuild the schema from db/schema.sql, seed it, empty the bucket
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
- **The review screen shows, it never asks** (ADR 008). Nothing on it is editable and nothing on it is a question: a value the model was not sure of arrives as an absent value, the card says so in a sentence, and the one remedy anywhere is photographing the letter again. A date reaches the calendar from exactly two sources, a confident read a person has seen, or nowhere.

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

The main checkout keeps the shared defaults (database `daykeeper`, port 3000); `worktree:setup` refuses to run there. Everything in `docs/start-here.md` applies unchanged otherwise.

**Environment problems wear a code-bug mask.** Check the environment before touching code:

| what you see | what it usually is | the fix |
|---|---|---|
| `ECONNREFUSED` / timeout at the database or at storage | docker is down, or `.env.local` was never written | `docker compose up -d`, then `npm run worktree:setup` |
| `EADDRINUSE` | a stale process on this worktree's own port | `npm run dev` clears its own port first; just rerun it |
| `Cannot find module ...` | dependencies not installed here | `npm ci` |

**Never edit application source or configuration to dodge an environment problem** — changing a port in code, pointing at a different database, weakening a check. If the environment blocks you, the fix is one of the commands above; if none of them fixes it, say so plainly instead of working around it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
