# DayKeeper (G1)

AI-powered life management system for people in vulnerable groups: upload a photo of a document, the system reads it, and it becomes tasks and reminders. RMIT COSC2648 capstone project, P000473SE, Group 1.

## Read this first

**[`docs/start-here.md`](docs/start-here.md)** — how to run it, what the seed data contains, where everything lives, and what is deliberately not built yet.

```bash
npm ci                    # exactly what package-lock.json says; do not use npm install
cp .env.example .env.local
docker compose up -d      # Postgres on 55432, a database viewer on 8080
npm run db:reset          # build the schema, then seed it
npm test
```

No account or credential is needed anywhere: the database runs locally in Docker and the document reader defaults to a mock that needs no API key.

## What is here

- [`docs/start-here.md`](docs/start-here.md): setup, the shape of the codebase, and the current state of play.
- [`docs/api.md`](docs/api.md): the API specification. **Not built yet**; this is the shape to build against.
- [`docs/architecture/`](docs/architecture/): four decision records. When something looks odd, the reason is in one of these. **They supersede the two planning documents below wherever the two disagree.**
- [`db/schema.sql`](db/schema.sql): the database, and its only definition. No migrations.
- `docs/project-description.md`: the official project description, verbatim. Our requirements baseline.
- `docs/DayKeeper-Tech-Stack-Recommendation.md`: Sai's technology stack proposal, 31 July. A draft the team never formally adopted; parts of it were later decided differently in the ADRs.
- `docs/Technical-Research-and-Implementation-Roadmap.md`: step-by-step research and build plan, 6 August. Same caveat.
- `docs/prototype/user/daykeeper-sketch-live.html`: clickable prototype of the user flow (phone). Open it in a browser.
- `docs/prototype/admin/daykeeper-admin-sketch.html`: wireframe of the admin dashboard (desktop). Static.
- `src/`: Next.js app (App Router, TypeScript, Tailwind, shadcn/ui). The pages currently read mock data; wiring them to real endpoints is the work.

## Team

Gerry Lu (Scrum Master) · Xiaocong "XC" Su · Hiruni Perera · Zhenying "Sai" Cui · Junchun "Jason" Zhang
Client: Prof. Mohammad Patwary · Supervisor: Dr. Golnoush Abaei
