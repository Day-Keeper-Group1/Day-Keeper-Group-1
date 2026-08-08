# AGENTS.md

DayKeeper (Group 1): an AI-powered life management system for people in vulnerable groups. A user uploads a photo of a letter or document, the system reads it, and it becomes tasks and reminders. RMIT COSC2648 capstone project, P000473SE.

## Where things live

- `docs/project-description.md`: the official project description, verbatim. Our requirements baseline; when wording conflicts, this file wins.
- `docs/DayKeeper-Tech-Stack-Recommendation.md`: the tech stack recommendation (draft until the team adopts it).
- `docs/Technical-Research-and-Implementation-Roadmap.md`: step-by-step research and build plan; check this before starting new feature work.
- `docs/prototype/user/daykeeper-sketch-live.html`: clickable prototype of the user flow (phone). The live one; this is where user-flow design work happens.
- `docs/prototype/admin/daykeeper-admin-sketch.html`: wireframe of the admin dashboard (desktop). Static, no interaction. Keep the two prototypes separate: different device, different person, different module.
- `docs/ai-prompts/`: AI usage records for the course GenAI declaration (create on first use). If AI helped with a change, log it there.
- `src/`: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui app. `AI_EXTRACTION_PROVIDER` defaults to a mock adapter; real OCR/AI provider wiring is owned by the AI teammate and lands separately.

## Conventions

- Everything in this repository is written in English.
- Say "photo upload", not "scan": the input is a phone photo of a document, per the project description's responsive web app framing.
- Commit messages in English, imperative mood. Do not add AI attribution or Co-Authored-By lines to commits.
- Never commit secrets, API keys, or `.env` files. Personal API keys and personal paid cloud accounts are banned for this project.
- Large binaries and generated output stay out of git (see `.gitignore`); small curated fixtures are fine.

## Build and test

```bash
npm ci           # installs exactly what package-lock.json says; never rewrites it
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Use `npm install <pkg>` only to intentionally change dependencies, and commit the resulting `package-lock.json` diff together with that change. If `git diff` shows lockfile churn and you did not change dependencies, revert it (`git checkout -- package-lock.json`). Node >=20.17 and npm >=11 are enforced through `engines` plus `.npmrc` engine-strict.

No automated tests yet (Vitest/Playwright land per the roadmap's Step 11). Copy `.env.example` to `.env.local` before touching auth/storage code.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
