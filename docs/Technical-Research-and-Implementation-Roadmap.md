# DayKeeper Technical Research and Implementation Roadmap

> **Aligned, not rewritten.** This document was written before the architecture
> decision records in `docs/architecture/`. The steps below have been corrected
> where they recommended something an ADR has since replaced; the plan, its
> order and its reasoning are otherwise unchanged. Where this document and an
> ADR still disagree, **the ADR wins**.

Date: 6 August 2026  
Revised: 18 August 2026, aligned to ADRs 001-008  
Status: Planning document, before implementation  
Audience: DayKeeper Group 1

## 1. Purpose

This document explains what the team should research and build step by step before starting implementation work. It also explains how Taste Skill should be used in this project.

The goal is to avoid uncontrolled "vibe coding". DayKeeper handles sensitive user documents and AI-generated actions, so the team should first agree on the architecture, data model, permission model, and UI direction.

## 2. Current Project Context

DayKeeper is an AI-powered responsive web application for vulnerable users. A user uploads a photo of a document, the system extracts key information, and confirmed obligations become tasks and reminders.

Phase 1 should focus on:

- Module 1: Physical Document Intelligence
- Module 4: Unified Archive and Action Engine
- Secure access, on the seeded accounts until registration and sign-in are built
- Admin dashboard

Future scope:

- Module 2: Email Intelligence
- Module 3: Voice and Conversation Intelligence

## 3. Readiness Assessment

The project can start **technical research and project foundation work now**.

Full feature development had to wait for seven agreements. Six of them have since been made, and where each one landed:

- MVP scope for Phase 1: Modules 1 and 4, with Modules 2 and 3 out of scope in the charter
- Authentication and authorization approach: our own users and sessions tables behind one function (ADR 002)
- Whether original uploaded documents must be stored: yes, as objects in an S3 bucket, never on the server's disk and never in a table (ADR 003)
- Extraction Contract JSON: six fields plus optional `due_time` (ADR 004)
- AI/OCR provider strategy: **still open**, waiting on what RACE grants and on which platform
- Database schema draft: `db/schema.sql`, which is not a draft but the only definition there is
- User confirmation workflow: the review screen shows and never asks; confirming is an empty POST (ADR 008)

Safe work to start now:

- Technical research
- Architecture decisions
- Repo structure planning
- UI prototype review
- Mock-data design
- Contract schema draft
- Jira ticket refinement

Risky work to avoid for now:

- Real AI API integration
- Email and voice modules
- Full organization admin system
- Automated actions without user confirmation
- Complex background job infrastructure

## 4. Recommended Technical Direction

Default recommendation:

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
lucide-react
Our own users and sessions tables, behind requireUser()
PostgreSQL through pg, no ORM
S3-protocol object storage, MinIO locally
Ownership enforced in every query
Zod
React Hook Form
Provider adapter with a mock default, real models through RMIT RACE
Vitest
Playwright
Docker Compose locally, deployment host undecided
```

The main reason is speed plus safety. One Next.js application gives the responsive web app, the dashboard UI and the server-side API surface with no second service to keep in step (ADR 001). Everything underneath it is something a teammate can run today with `docker compose up -d`: a Postgres nobody has to be given an account for, and an S3 bucket that is the same code against MinIO now and against whatever the host provides later (ADR 003).

A managed provider is not ruled out. Authentication reaches the rest of the application through exactly one function, so adopting one later replaces a file rather than the schema (ADR 002).

## 5. Step-by-Step Plan

### Step 0: Requirements and Backlog Lock

Goal:

- Convert current backlog into a stable MVP scope.
- Separate Must, Should, Could, and Future items.
- Remove contradictions from reviewed backlog decisions.

Outputs:

- Clean product backlog
- MVP feature list
- Jira tickets
- Open questions for supervisor/client

Possible tools:

- Jira
- GitHub Issues
- Markdown docs
- Meeting minutes template

Code readiness:

- No application code needed.
- This step should happen before Sprint 1 coding.

Key decisions:

- Phase 1 only includes Module 1 and Module 4.
- Module 2 and Module 3 stay as Future Scope.
- Uploaded photographs are saved, as objects in the bucket rather than rows in a table or files on a server's disk (ADR 003).

### Step 1: Architecture Decision Records

Goal:

- Make explicit decisions about framework, auth, database, file storage, AI provider strategy, and deployment.
- Record the reasons so the final report can explain the team's engineering choices.

Outputs (all written, `docs/architecture/`):

- `adr-001-web-framework.md`
- `adr-002-auth-and-permissions.md`
- `adr-003-data-storage.md`
- `adr-004-extraction-contract.md`
- `adr-005-ingestion-and-grouping.md`
- `adr-006-matching-and-the-projection.md`
- `adr-007-the-tick-is-the-only-state.md`
- `adr-008-show-dont-ask.md`

Possible technology stack:

- Markdown ADRs
- Mermaid diagrams
- GitHub pull requests for review

Code readiness:

- Done. The eight above are the decisions the rest of this roadmap is now written against.
- Deployment is still undecided and is deliberately not an ADR yet.

### Step 2: Project Foundation

Goal:

- Create a clean Next.js project foundation.
- Establish basic engineering standards before feature work begins.

Outputs:

- Next.js app scaffold
- TypeScript configured
- Tailwind configured
- ESLint and formatter configured
- `.env.example`
- Basic folder structure
- README updated with commands

Possible technology stack:

- Next.js App Router
- TypeScript
- npm (the lockfile is `package-lock.json`, installs are `npm ci`)
- Tailwind CSS
- ESLint
- Prettier
- shadcn/ui
- lucide-react

Code readiness:

- Done. The scaffold, the linting, the hooks and `.env.example` are on `main`; `docs/start-here.md` is the README this step asked for.

Actual folder structure:

```text
src/
  app/
  components/
  lib/
    contract/
  server/
    auth/
    extraction/
docs/
  architecture/
db/
  schema.sql
tests/
```

`db/schema.sql` is the whole database. There is no `migrations/` directory and there is not going to be one this semester; see Step 4.

### Step 3: Authentication and Authorization Research

Goal:

- Decide how users and admins log in.
- Decide who can access each document, task, reminder, and admin view.

Outputs:

- Auth flow diagram
- Role model
- Ownership rule for every query
- Auth implementation ticket list

Decided option (ADR 002):

- Our own `users` table, passwords hashed with scrypt from Node's crypto module
- Sessions as rows in `sessions`, keyed by the SHA-256 of a token held in an httpOnly cookie
- Exactly one function, `requireUser()` in `src/server/auth/session.ts`, and nothing else in the application knows how somebody is authenticated

Not chosen, and why it is still reachable:

- A managed provider (Supabase Auth, Auth.js) would have to be provisioned by somebody with an account, which the project's ban on shared and personally paid cloud accounts makes slow, and its own `auth.users` schema would end up underneath every table we own. Because the interface is one function either way, adopting one later replaces that file and nothing else.
- Row level security is not used. Ownership is enforced in the queries, every one of which is scoped by user id, and a test proves one person's document is invisible to another.

Recommended roles:

```text
user
platform_operator
org_admin
org_worker
```

Phase 1 can implement:

- `user`
- `platform_operator`

Future scope can include:

- `org_admin`
- `org_worker`

Code readiness:

- The schema and the password hashing are on `main`; the session handling is to be built against the one-function rule.
- Registration and sign-in exist as endpoints in `docs/api.md` but are deliberately low priority. The seeded accounts (`margaret@example.com`, `operator@example.com`, password `daykeeper`) and the seeded development session are what everyone builds against until somebody writes the real thing.
- Password reset needs an email sender nobody has chosen, so the page exists and does nothing.

### Step 4: Database and Storage Design

Goal:

- Define how DayKeeper stores users, documents, extraction results, tasks, reminders, and audit logs.

Outputs:

- Entity relationship diagram (`docs/schema-map.html`)
- `db/schema.sql`, the only definition there is
- `npm run db:reset` and a seed that puts a complete world back
- Storage module, `src/server/storage.ts`

Possible technology stack:

- PostgreSQL in Docker, spoken as plain SQL through `pg`, no ORM
- One schema file and no migrations, per ADR 003
- JSONB for extraction payloads (`open_payload`)
- An S3-protocol bucket, MinIO in `docker-compose.yml` locally
- Ownership scoped into every query, not row level security

Core tables (fourteen, plus one view):

```text
users
sessions
documents
upload_batches
upload_pages
grouping_runs
document_pages
extraction_runs
extracted_fields
matching_runs
tasks
reminders
audit_logs
ai_prompt_logs
document_search   (a view, not a table)
```

Storage rule:

- Store uploaded photographs in the bucket, never on the server's disk and never in a table.
- Store the key and the metadata in Postgres.
- Reach the bytes only through `src/server/storage.ts`. A route that hands out a signed link is still the place ownership gets checked: a signed URL expires, but it does not ask who is holding it.

Migration rule:

- There are no migration files. To change the shape of the database you edit `db/schema.sql` and run `npm run db:reset`, which drops everything, rebuilds it, reseeds and empties the bucket in the same breath.
- This is safe because there is no data anybody would mind losing, and it means every teammate's database is identical to every other's. It has an expiry date: the first migration tool arrives before the first real user does.

Code readiness:

- Done. The schema, the seed and the reset script are on `main`, and `document_search` is the projection ADR 006 matches against.
- Adding a table later is free under the no-migrations rule, which is why the open items in `docs/api.md` (a `notifications` table, for one) are not blocking anything.

### Step 5: Extraction Contract

Goal:

- Define the stable interface between Module 1 and Module 4.
- Make AI output predictable and safe to consume.

Outputs:

- Contract JSON schema
- Zod runtime validator
- Example valid payloads
- Example uncertain/unreadable payloads
- Mock extraction provider

Possible technology stack:

- Zod
- TypeScript types inferred from Zod
- JSON Schema
- Mock provider
- Vitest

Field status values:

```text
confirmed
uncertain
unreadable
```

`uncertain` is storage only. It is kept because how often the model hedges, and what it guesses when it does, is evaluation data. Every outward surface collapses it to `unreadable`, server-side, in one place: no screen, no API response and no projection ever carries a value the model was not sure of (ADR 008).

Core fields, six of them:

```text
document_type
issuer
action_required
due_date
amount
reference
```

Plus `due_time` (`HH:mm`), optional, present only when the page prints one. It is what marks a document as an appointment rather than a deadline, which changes how its reminders are planned.

Six is a floor, not a ceiling: a provider that returns more is not punished, the extra lands in `open_payload`. A payload missing one of the six is rejected, and a field the reader could not read must say `unreadable` rather than be omitted.

Two fields this step used to list and the contract does not have:

- `summary` is not a seventh contract field. As prose on a screen it is a hallucination surface aimed at the readers least able to spot an invented sentence (ADR 004). It comes back in ADR 006 as a column on `documents` and a section of the search projection, where it is read by the matching model and never by a person, so that it cannot reach a screen by accident.
- `raw_text` is gone with contract 2.0. It was designed as independent evidence beside the model's answer, produced by an OCR stage that is not happening this semester. Without that stage it is the same model testifying twice.

Code readiness:

- Done. `src/lib/contract/` holds the six fields, the grouping manifest, the reminder planner and their validators, with tests that need no database and no network.
- Import those types rather than restating them.

### Step 6: Document Photo Upload Flow

Goal:

- Let users post a pile of photographs through the responsive website.
- Keep the flow clear for mobile users.

Outputs:

- Capture page
- File validation
- Batch status display, and the letters that come out of a batch

Possible technology stack:

- Next.js client components
- Browser file input with camera capture support
- `src/server/storage.ts` for the bytes
- Zod file metadata validation
- shadcn/ui form components

An upload is a batch, not a letter (ADR 005):

- `POST /api/documents` takes up to ten photographs, ten megabytes each, and answers with the **batch**, because at the moment the files are stored nothing knows what is in them.
- A vision pass then divides the pile and answers with a manifest: each letter as the photographs that make it, in reading order, and every photograph that is no letter at all. A photograph of a grandchild becomes nothing, which is an answer rather than a leftover.
- There is no screen that asks a person to confirm the grouping. A merge shows up as one letter whose fields contradict each other and a split as two letters half unreadable, both on the review screen she is already reading, so a confirmation step would catch nothing and hand the sorting back to her.
- One batch row therefore becomes several letters on screen. Exactly how that motion looks is on the open list in `docs/api.md`.

Important wording:

- Use "photo upload" instead of "scan" in the UI and docs. The input is a phone photo of a document, which is what the project description's responsive web app framing describes.

Code readiness:

- Start after project foundation and storage design. The contract types for the manifest already exist in `src/lib/contract/grouping.ts`.

### Step 7: AI/OCR Provider Research

Goal:

- Compare realistic AI/OCR options without locking the app to one provider too early.
- Confirm what model access RMIT RACE can grant, and on which platform.

Outputs:

- Provider comparison table
- Cost and access notes
- Data privacy notes
- Adapter interface
- Experiment plan

Possible technology stack:

- A vision model called over HTTP with an image and a prompt, whichever platform RACE ends up providing
- OCR only as an experiment-line baseline (Tesseract, or a hosted OCR service), not as a stage the contract depends on
- Provider adapter pattern

Recommended design:

```text
DocumentExtractionProvider
  mock provider (the default, needs no credentials)
  one real provider, once RACE grants access
  optional ocr baseline provider, experiment line only
```

Three jobs, not one, and all three are model calls behind an interface: dividing a batch into letters (ADR 005), reading a letter's fields (ADR 004), and placing a letter against the archive (ADR 006). Dividing a pile is visual bookkeeping rather than deep reasoning, so the miss-rate experiment should put the small fast models next to the large ones.

Code readiness:

- Start with the mock provider. It is deliberate about misbehaving: it takes two to seven seconds, hedges on the due date about half the time, and fails outright about one document in eight, because a mock that always succeeds instantly produces an interface with no waiting state and no failure path.
- Do not use personal paid API keys, and do not put a personal cloud account behind this.
- Real integration waits for RACE. `AI_EXTRACTION_PROVIDER=openai` throws rather than silently falling back to the mock, because silently fabricating readings of real letters is the worst thing this system could do.

### Step 8: Review and Confirmation UI

Goal:

- Let the user recognise what was read before tasks are created.
- Ask nothing. The product shows, it never asks (ADR 008).

Outputs:

- Confirm box page, read-only
- Rows for the values the model read confidently, and no row at all for the rest
- A card-level sentence naming what is missing
- Generate task only after confirmation

Possible technology stack:

- shadcn/ui cards, not forms
- Tailwind CSS
- An empty `POST /api/documents/:id/confirm`, whose only error is that the document was already confirmed

Core principle:

- Trusting the model includes trusting its "I am not sure". A hedged value is never shown, so a person is never asked to overrule a hesitation she is the least equipped in the world to adjudicate.

What this step must not build:

- No editing of any field, no date box, no manual calendar entry. The one remedy for anything wrong or missing is photographing the letter again, through the same capture screen as everything else, and the matching step placing the new reading against this letter is what corrects the record.
- No amber "this was hard to read, is it right?" box, no acknowledge step, no `acknowledged_at`. A row without a confident value is not drawn at all, because an empty row invites an answer nobody is being asked for. The card says it in one sentence instead: "This letter doesn't give a clear date. It's saved; nothing goes on your calendar."
- No page-text snippet beside the value. It would be the same model testifying twice.
- Date filling is deferred, not rejected. If it comes back it comes back as a designed feature, not as a text box that happened to be lying around.

The product has two verbs, photograph and tick, and a person never needs to learn a third.

Code readiness:

- Start after Contract JSON and mock extraction provider exist. Both do.

### Step 9: Task and Reminder Engine

Goal:

- Turn confirmed obligations into tasks and reminders.
- Let users manage open, upcoming, overdue, and completed tasks.

Outputs:

- Task list
- Task detail page
- Reminder rows, planned at confirm time
- Derived overdue state
- Tick and untick

Possible technology stack:

- Next.js route handlers
- Postgres through `pg`
- Date utilities from `src/lib/contract/dates.ts`, and `users.timezone` for whose morning "9 am" means
- Optional scheduled jobs later

The tick is the only stored state (ADR 007):

- A task stores one fact a person controls: whether it is ticked. Completed, overdue and upcoming are worked out while drawing, from the tick and today's date in her zone. Nothing writes "overdue" anywhere, so nothing has to wake up at midnight and nothing can forget to un-write it.
- Ticking is never locked, in either direction, forever, from the home list and from the calendar's day sheet.
- Overdue is told in words and never in colour: "was due Wed 5 Aug", set bolder. Red already means a failed reading here, and colour is never the only signal. Due date ascending puts overdue rows first, so the sort is the pinning.

MVP reminder approach:

- Reminder rows are planned at confirm time by `planReminders()` and nowhere else: a deadline gets 7, 3 and 1 days before at 9 am local, an appointment (anything with a `due_time`) gets one, the day before. A reminder whose day has already gone by is never created.
- **Ticking writes nothing to reminders, and unticking writes nothing back.** When a reminder's moment arrives the dispatcher reads the task at that moment: still open means send and write `sent`, already done means send nothing and write `skipped`. There is no `cancelled` status, because nothing writes it, and there is no revival rule, because there is nothing to revive.
- `reminder_status` is `scheduled | sent | skipped | failed`.
- Show reminders in-app. Email reminders can be Should/Could unless confirmed as Must.
- What wakes the dispatcher up is still open: a cron job, a platform scheduler, or in-app only. What it decides is settled.

Home list rule:

- Every open task whatever its date, plus anything completed within seven days of the tick, by due date ascending with dateless tasks last, capped at twenty. Open tasks are never filtered by date: an unpaid bill from three weeks ago is the loudest thing this person owns.

Code readiness:

- Start after user confirmation flow works. `src/lib/contract/reminders.ts` is already the one place the scheduling rule lives, and both the review card and the confirm handler call it with the same `today` so they cannot disagree.

### Step 10: Admin Dashboard

Goal:

- Provide a basic platform operator dashboard without exposing sensitive user content.

Outputs:

- Admin login/access guard
- Processing status summary
- Failure log
- Non-sensitive usage metrics
- User account status view

Possible technology stack:

- Next.js protected routes
- `requireUser()` and the `user_role` enum
- Ownership and role checks written into the queries
- SQL aggregate queries
- shadcn/ui tables/charts

Phase 1 admin scope:

- Platform operator dashboard
- System health
- Usage counts
- Processing errors

The operator role deliberately grants no access to letter content. That is the promise the admin prototype makes on screen, and `audit_logs` has nowhere to put the contents of a letter, so the schema is built such that it cannot quietly be broken.

Future admin scope:

- Organization admin
- Worker access to client records
- Service authorization model

Code readiness:

- The role model is agreed; the operator's exact permissions are not, and the admin endpoints are on the open list in `docs/api.md` until they are.

### Step 11: Testing and Quality Gates

Goal:

- Make sure the app works and sensitive data is protected.

Outputs:

- Unit tests
- Contract tests
- E2E tests
- Security checks for unauthorized access

Possible technology stack:

- Vitest
- React Testing Library
- Playwright
- The Docker Postgres and MinIO everyone already runs, rebuilt by `npm run db:reset`

Minimum tests:

- A person can sign in with a seeded account.
- A person can post a pile of photographs, and the batch answers before anything has been read.
- The mock reader returns a conformant payload, and one missing a required field is rejected.
- A field the model was unsure of leaves the server as `unreadable`, on every surface.
- Confirming an already confirmed document answers `409`.
- Confirming creates the task and exactly the reminder rows `planReminders()` planned.
- Ticking a task writes no reminder row, and a reminder firing against a done task writes `skipped`.
- Another person cannot read the document.
- An operator cannot see letter content anywhere.

Code readiness:

- Tests should start as soon as contracts and routes exist. `tests/contract.test.ts` runs today with no database and no network, and `tests/theme.test.ts` fails the build if a palette colour drifts.

### Step 12: Deployment Research

Goal:

- Decide where the prototype runs, given that the risk register records that hosting may not satisfy RMIT or client constraints.

Outputs:

- Deployment decision
- Environment variable list
- Demo URL plan
- Data handling note

Possible technology stack:

- Any host that runs a Next.js application
- Ordinary managed Postgres
- Any S3-protocol bucket

Recommendation:

- Nothing in the build forecloses the choice, and that is deliberate. The schema depends on no vendor extension and runs anywhere Postgres does; the storage code written against MinIO is the same code that runs against S3, R2 or a managed bucket, with the endpoint and the credentials as environment variables.
- The host is on the open list until somebody decides. Do not adopt a platform's auth or storage on the way to picking one: that is the decision that would be hard to reverse.
- Locally everything is `docker compose up -d`: Postgres on 55432, MinIO on 59000, viewers on 8080 and 59001.

Code readiness:

- `.env.example` exists and is the list.
- Do not deploy with real private documents at any point. Development and testing run on the synthetic dataset; real letters are the legal problem the synthetic line exists to avoid.

## 6. Taste Skill Usage in DayKeeper

### What Taste Skill is

Taste Skill is a third-party `SKILL.md` package for AI coding agents. It gives frontend design guidance to reduce generic AI-generated UI output.

It is useful for:

- Visual direction
- Typography checks
- Spacing checks
- Layout quality
- Redesign review
- Landing pages and polished visual pages

It is not the core DayKeeper technology stack.

It does not replace:

- Next.js
- The database and storage design
- Auth
- `docs/theme.md`, which is this product's actual visual authority
- OCR/AI provider design
- Contract JSON
- Accessibility requirements

### Important caution

DayKeeper is mostly a product dashboard with document review, task lists, admin views, and forms. Taste Skill's own core skill is primarily positioned for landing pages, portfolios, and redesigns, not dashboard/data-table-heavy product UI.

Therefore, do not install or apply it blindly as a project-wide rule.

Recommended use:

- Use Taste Skill as a **UI polish and review aid**.
- Use it for prototype refinement.
- Use it for a public/demo landing page if the team creates one.
- Use selected design ideas for dashboard quality, but keep DayKeeper's product requirements in control.

### When to use it

Use Taste Skill during these moments:

1. Before designing the first user dashboard.
2. Before redesigning the upload and confirmation flow.
3. Before presenting UI to the client.
4. Before final demo polish.
5. When an AI-generated screen looks too generic.

Do not use it during:

- Database schema work
- Auth and permissions design
- API contract work
- AI/OCR provider integration
- Backend testing

### How to install if the team agrees

Possible install command:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

For Codex-specific installation:

```bash
npx skills add Leonxlnx/taste-skill -a codex
```

Do not run these commands until the team agrees. Installing a skill changes how the AI agent may approach frontend work.

### How to apply it in prompts

Good DayKeeper prompt:

```text
Use Taste Skill only as a visual polish guide. Build a restrained operational dashboard for DayKeeper, not a marketing page. The target users may have cognitive overload, so prioritize clarity, readable hierarchy, calm spacing, obvious actions, and mobile usability. Avoid decorative hero sections, generic feature cards, and flashy gradients.
```

Good review prompt:

```text
Review this DayKeeper screen using Taste Skill as a UI quality checklist. Focus on whether the layout is clear, accessible, responsive, and suitable for document review and task management. Do not make it look like a landing page.
```

Bad prompt:

```text
Use Taste Skill to make the whole app beautiful and creative.
```

Why bad:

- It is too broad.
- It may push the AI toward visual decoration.
- It does not protect dashboard usability.

### Suggested DayKeeper design principles

Use these principles even if Taste Skill is installed:

- Product UI first, landing page second.
- Calm dashboard, not flashy marketing.
- Clear status labels, spelled the way the database spells them so nothing is translated on the way to the screen: `needs-review`, `confirmed`, `overdue`, `completed`.
- Tap targets sized for the audience: body text at least 18px, primary buttons at least 48px tall.
- Strong contrast for important actions: body text clears 7:1, and colour is never the only signal.
- Say plainly what could not be read, in a sentence, and show nothing hedged. That is not the same as hiding uncertainty: the missing value is named, it is just never dressed up as an answer or as a question.
- Do not overload vulnerable users with dense screens.
- Make the next action obvious.
- Every generated task must link back to the source document.

## 7. Recommended First Technical Research Tasks

These tasks can start before full coding:

| Task | Owner suggestion | Output | State |
|---|---|---|---|
| Decide the auth approach | Sai / XC | ADR draft | Done, ADR 002 |
| Draft database schema | Jason / Sai | ERD and table list | Done, `db/schema.sql` and `docs/schema-map.html` |
| Draft Contract JSON with Zod shape | Sai / Jason | Schema document | Done, `src/lib/contract/` |
| Research AI/OCR provider options | Sai / Jason | Provider comparison | Open, waiting on RACE access |
| Measure how often the reader divides a batch wrongly | Jason / Sai | Miss rate, per model | Open, and it validates or kills ADR 005 |
| Review UI prototype with accessibility focus | XC / Hiruni | UI notes | Open, `docs/theme.md` is the standard to review against |
| Define admin dashboard MVP | Gerry / Hiruni | Admin scope note | Open, blocks the admin endpoints |
| Clean backlog contradictions | Gerry / team | Jira-ready backlog | Done |

## 8. Recommended Coding Order

Once the team is ready to start implementation, use this order:

1. Scaffold Next.js project.
2. Add Tailwind and base UI components.
3. Add `.env.example`, the Docker Compose stack, and the two server modules everything else goes through: `src/server/db.ts` and `src/server/storage.ts`.
4. Put `requireUser()` in front of the pages and build on the seeded accounts. Registration and sign-in pages come later.
5. Write `db/schema.sql` and its seed, and change the database from then on by editing that file and running `npm run db:reset`.
6. Add protected dashboard shell.
7. Add the batch upload flow: a pile of photographs in, the batch back straight away, letters appearing as the reading divides them.
8. Add Contract JSON and mock extraction.
9. Add review/confirm UI, read-only, confirmed by an empty POST.
10. Generate tasks from confirmed fields.
11. Add in-app reminders, planned at confirm time and judged at fire time.
12. Add basic admin dashboard.
13. Add tests.
14. Add the real provider after RACE access is confirmed.

Steps 1, 2, 3, 5 and 8 are on `main` already, and step 4 has its schema and its password hashing but not its session handling. The work in front of the team starts at wiring the pages to real endpoints.

## 9. Final Recommendation

The team should begin with technical research and foundation work, not feature-heavy implementation. That research has since been done and the foundation is on `main`, so both recommendations below have moved on with it.

Immediate next step, as it was written:

```text
Write ADRs for auth, data storage, and the AI extraction contract.
```

Done, and five more with them: ADRs 001 to 008. Deployment is deliberately still not one of them, because nobody has picked a host.

First code step, now that the scaffold exists:

```text
Wire the pages to real endpoints: the batch upload, the reading that
divides it into letters, and the read-only card that confirms one.
```

Taste Skill should be used later as a frontend polish assistant, not as the main technical decision-maker for DayKeeper.

## 10. Sources Checked

- Taste Skill docs: https://www.tasteskill.dev/docs
- Taste Skill GitHub repository: https://github.com/Leonxlnx/taste-skill
- Next.js docs: https://nextjs.org/docs
- node-postgres docs: https://node-postgres.com/
- Node.js crypto docs, for `scrypt`: https://nodejs.org/api/crypto.html
- MinIO docs, for the S3 protocol locally: https://min.io/docs/minio/linux/index.html
- PostgreSQL JSON types docs: https://www.postgresql.org/docs/current/datatype-json.html
- OpenAI image and vision docs: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI Structured Outputs docs: https://developers.openai.com/api/docs/guides/structured-outputs
- Zod docs: https://zod.dev/
- Playwright docs: https://playwright.dev/docs/intro

Read for the managed-provider direction that ADRs 002 and 003 did not take, and kept here so the report can show it was considered rather than missed:

- Supabase Auth docs: https://supabase.com/docs/guides/auth
- Supabase Row Level Security docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage access control docs: https://supabase.com/docs/guides/storage/security/access-control
- Auth.js Prisma Adapter docs: https://authjs.dev/getting-started/adapters/prisma
