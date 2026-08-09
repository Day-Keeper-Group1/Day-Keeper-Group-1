# DayKeeper Group 1 - Technical Stack Recommendation

> **Superseded in part.** This document predates the architecture decision
> records in `docs/architecture/`. Where the two disagree, **the ADRs win**:
> this project does not use Supabase Auth (ADR 002), has no migrations and runs
> Postgres locally in Docker (ADR 003), and the extraction contract is six
> fields, not seven (ADR 004). The rest of this document still stands.

Date: 31 July 2026  
Author: Sai / Group 1 working note  
Status: Draft for team discussion  
Amended: 2 August 2026 (review pass)

## 1. Executive Recommendation

DayKeeper should be built as a **responsive web application**, not a native mobile app. The recommended stack is:

| Layer | Recommended choice | Why |
|---|---|---|
| Web framework | **Next.js + TypeScript + App Router** | Full-stack React framework, good for dashboards, route handlers, server components, and fast prototyping. Official docs list Next.js as a framework for full-stack web apps and current docs use the App Router path. |
| UI | **Tailwind CSS + shadcn/ui + lucide-react** | Fast dashboard UI, accessible components, consistent design, minimal custom CSS. |
| Auth | **Supabase Auth** | Fastest way to implement login, sessions, JWT, and future role-based access. Integrates naturally with Supabase RLS. |
| Authorization | **Postgres Row Level Security (RLS) + app-level roles** | Important because documents may contain private/medical/financial information. RLS gives database-level defense. |
| Database | **Supabase Postgres** | Matches the proposed architecture: relational core tables + JSONB extraction payload. |
| File storage | **Supabase Storage private bucket** | Uploaded documents should not be stored directly in the database. Storage policies can use RLS. |
| AI/OCR integration | **Provider adapter layer**: RMIT/AWS Bedrock (RACE) primary, mock provider default until keys arrive, unfunded OpenAI-compatible slot | Do not lock the app to one model provider before resource access is confirmed. |
| AI output contract | **Zod schema + JSON Schema / Structured Output** | Extraction output must be predictable: fields, statuses, and user-confirmation state. |
| Background work | **Route handler with an explicit maxDuration; extraction_runs doubles as the queue; hourly pg_cron sweep fails/retries stuck runs** | OCR/LLM extraction can take time; UI polls a status column. No Redis and no second runtime on the free tier. |
| Reminders/notifications | **pg_cron + pg_net calling an internal Next.js route + in-app notification center; email only once a verified sender exists** | Vercel Hobby cron fires at most once per day, so the scheduler must live in Postgres. |
| Evaluation layer | **Offline Python workspace (uv, pytest, opencv, Augraphy)** | Scores extraction quality against labelled fixtures; never deployed, costs nothing. See the Evaluation section. |
| Testing | **Vitest + Playwright** | Unit/schema tests for contracts and E2E tests for upload-confirm-reminder flows. |
| Deployment | **Vercel + Supabase for MVP**, or **Docker self-hosting** if client/RMIT requires it | Vercel/Supabase is fastest. Docker path is safer if hosting must be controlled by RMIT/client. |

Short version: **Next.js + TypeScript + Supabase Auth/Postgres/Storage + Tailwind/shadcn + Zod + Playwright, plus an offline Python evaluation workspace.**

## 2. Project Requirements That Drive the Stack

The technology choices should fit these product requirements:

- The product is a **website** usable on mobile, tablet, and desktop.
- Phase 1 focuses on:
  - Module 1: document photo upload and AI extraction.
  - Module 4: unified archive, tasks, reminders, user registration, admin dashboard.
- Uploaded documents may contain sensitive information.
- AI extraction can be wrong, so the app must support:
  - `confirmed`
  - `uncertain`
  - `unreadable`
  - user correction before task/reminder generation.
- Future scope may include:
  - Email channel.
  - Voice/call channel.
  - Organization/admin dashboard.
  - Permissioned worker access to client records.

This means we should avoid a toy frontend-only app. We need auth, storage, database permissions, structured extraction, and an auditable workflow.

## 3. Recommended Architecture

```mermaid
flowchart LR
    U[User browser] --> UI[Next.js responsive web app]
    UI --> AUTH[Supabase Auth]
    UI --> API[Next.js server actions / route handlers]
    UI -->|signed upload| ST
    API --> DB[(Supabase Postgres)]
    API --> ST[Supabase Storage private bucket]
    API --> AI[AI/OCR provider adapter]
    AI --> API
    DB --> UI

    subgraph DBData[Data model]
      USERS[profiles / roles]
      DOCS[documents]
      EX[extraction_runs + JSONB payload]
      TASKS[tasks]
      REM[reminders]
      AUDIT[audit_logs]
    end

    DB --- DBData
```

## 4. Frontend Choice

### Recommended: Next.js + TypeScript

Use:

- `Next.js`
- `TypeScript`
- `App Router`
- `src/` directory
- `pnpm`

Why:

- Next.js is designed for full-stack React web applications, so one project can contain UI pages, server-side handlers, and API routes.
- App Router is the newer routing model and supports modern React features such as Server Components.
- This project is dashboard-heavy, not animation-heavy, so Next.js is a strong fit.

Suggested setup:

```bash
pnpm create next-app@latest day-keeper-group-1 --src-dir
```

Recommended options:

- TypeScript: yes
- ESLint: yes
- Tailwind: yes
- App Router: yes
- Import alias: `@/*`

### UI styling

Use:

- `Tailwind CSS`
- `shadcn/ui`
- `lucide-react`

Why:

- Tailwind is fast for responsive dashboard layout.
- shadcn/ui gives ready-made components such as buttons, dialogs, forms, tabs, tables, badges, dropdowns, and calendars.
- lucide-react gives clean icons for upload, scan, calendar, alert, check, admin, and document actions.

Do not over-design the UI as a marketing landing page. DayKeeper is an operational dashboard: documents, tasks, reminders, review states, and admin panels should be easy to scan.

### PWA and text scale

- Ship a web app manifest and installability from the start. It costs nothing, gives users a home screen icon, and is the prerequisite for web push on iOS later.
- shadcn defaults are tuned for dense professional dashboards. Raise the base type scale and spacing globally in the design tokens for this product's audience. Do it once in the tokens, not per component.

## 5. Authentication And Authorization

### Recommended auth: Supabase Auth

Supabase Auth is the best default for this project because it gives:

- email/password login
- magic link / OTP option if needed
- JWT sessions
- integration with Postgres
- integration with RLS
- easier future support for organization-level access

Suggested roles:

| Role | Meaning |
|---|---|
| `user` | Normal DayKeeper user. Uploads own documents and confirms tasks. |
| `org_worker` | Worker from an organization who can access only authorized clients. Future scope. |
| `org_admin` | Organization-level admin. Manages workers/clients. Future scope. |
| `platform_operator` | System operator. Can view operational health, not private user document content by default. |

Suggested tables:

```text
profiles
organizations
organization_memberships
documents
document_permissions
extraction_runs
tasks
reminders
notifications
audit_logs
extraction_logs
```

Naming note: extraction_logs was ai_prompt_logs in the first draft. Renamed to avoid confusion with docs/ai-prompts, which is a different thing: the table stores runtime prompts and outputs sent to providers, written by the adapter on every call and read by the evaluation workspace and during debugging; the folder stores the team's AI usage records for the course GenAI declaration.

Migration note: organizations and organization_memberships stay in this list as design headroom but are not created in the initial migrations. Organization features are future scope; keying everything through profiles keeps that door open without carrying empty tables. audit_logs joins them: it is not created until a milestone builds its reader (the admin dashboard is the natural one).

Important rule:

> Authentication answers "who is this user?" Authorization answers "what is this user allowed to see or do?"

For this project, authorization is more important than usual because documents may include bills, medical letters, government forms, and personal information.

### Database access pattern (decision to confirm)

RLS is only a real defense when queries carry the user's identity. Two safe patterns:

1. The browser talks to Supabase with the anon key; RLS is the primary gate.
2. Server code builds a per-request client with the user's JWT, so queries still run as that user.

The service role key bypasses RLS entirely. It must never appear in general request handlers. Quarantine it in one small admin module with its own review rule. The test "another user cannot view the document" in the testing section is what keeps this honest.

One more free tier consequence: the Supabase default auth mailer is not a usable channel. It only delivers to the project's own team members' addresses and is capped at a couple of messages per hour; it exists for development only. Disable email confirmation for the MVP (five users and a client demo gain nothing from it), and revisit only if the email channel gets a verified sender (see Reminders and notifications).

### Why Supabase Auth over Auth.js?

Auth.js is a good option, especially with the Prisma adapter, but for DayKeeper it creates more work:

- You still need to design database authorization.
- You still need private file storage.
- You still need organization membership access control.
- You still need to protect uploaded documents.

Supabase Auth + RLS + Storage solves more of the project surface in one consistent system.

### When to choose Auth.js instead

Choose **Auth.js + Prisma + self-hosted Postgres** only if:

- the client/RMIT does not allow Supabase,
- deployment must be fully self-hosted,
- the team wants all database access to go only through the Next.js server,
- or the project requires a custom auth flow Supabase does not support.

If using Auth.js, the recommended stack becomes:

```text
Next.js
Auth.js
Prisma
PostgreSQL
S3-compatible storage
Docker
```

This is more flexible but slower to implement.

## 6. Database Design

### Recommended: Postgres with relational tables + JSONB

Use relational tables for stable product entities:

- users/profiles
- organizations
- documents
- tasks
- reminders
- permissions
- audit logs

Use `JSONB` for variable extraction payload:

```text
documents
  id
  owner_id
  storage_path
  document_type
  created_at

extraction_runs
  id
  document_id
  provider
  model
  status
  contract_json jsonb
  raw_output jsonb
  created_at
```

Why JSONB:

- A bill, medical letter, insurance document, and government form do not share the exact same schema.
- The action core should be typed.
- Extra extracted fields can live in a flexible payload.
- Postgres JSONB supports querying and indexing if needed.

### Contract JSON

Every extraction result should follow a strict contract:

```json
{
  "document_type": { "value": "utility_bill", "raw_text": "Electricity bill", "status": "confirmed" },
  "issuer": { "value": "Energy Provider", "raw_text": "Energy Provider Pty Ltd", "status": "confirmed" },
  "action_required": { "value": "Pay bill", "raw_text": "Please pay by the due date", "status": "confirmed" },
  "due_date": { "value": "2026-08-15", "raw_text": "15/08/26", "status": "uncertain" },
  "amount": { "value": "125.40", "currency": "AUD", "raw_text": "$125.40", "status": "confirmed" },
  "reference": { "value": "REF123456", "raw_text": "Reference: REF123456", "status": "confirmed" }
}
```

Evidence geometry (page and bounding box) was in the first draft of this contract and is deferred on purpose. The only extractor is a vision LLM, and current vision models return approximate, run-to-run unstable coordinates, so a mandatory bbox would be filled with plausible fiction that nothing in the MVP reads anyway. `raw_text` is the grounding the confirm screen actually needs: the user reads "15/08/26" next to the parsed date and judges it in one glance. Reintroduce an optional `evidence` object only when a source that emits real geometry exists (an OCR engine, not the LLM).

Before freezing this in Zod (Milestone 3), settle four things:

- `amount` carries an explicit `currency`.
- `due_date` is a local calendar date; decide where it becomes a point in time (the user's profile timezone is the natural place).
- The no-action case must be expressible: `action_required.value` may be `"none"`, so a document that requires nothing is a first-class result, not a validation error.
- An optional `additional_fields` record (same value/raw_text/status shape, free keys) is the extension slot that justifies JSONB storage.

Use `Zod` in the codebase to validate this at runtime. TypeScript alone is not enough because AI output and API responses are untrusted runtime data.

## 7. AI/OCR Stack

### Recommended design: provider adapter

Do not directly scatter OpenAI/Claude/Bedrock calls across the app. Create one interface:

```ts
export interface DocumentExtractionProvider {
  extract(input: {
    documentId: string
    storagePath: string
    documentHint?: string
  }): Promise<ContractJson>
}
```

The adapter fetches file bytes server-side from storage. Signed URLs must not be handed to external providers: that would send user documents outside our infrastructure as links, and Bedrock-style APIs want bytes anyway.

Then implement adapters:

```text
providers/bedrock-extraction.ts   primary target (RMIT RACE)
providers/openai-extraction.ts    empty slot: only if RMIT provides an OpenAI-compatible endpoint
providers/mock-extraction.ts      default until real keys arrive
```

Use `mock-extraction.ts` first so frontend and backend can be developed before real API keys arrive.

The fallback slot is deliberately unfunded: personal keys and personal paid cloud are banned (see What Not To Do), and free consumer API tiers are not an acceptable place to send medical or financial documents. The zero-cost fallback for experiments is a Tesseract text-only baseline inside the evaluation workspace, not a second cloud provider.

A separate Python API service was considered and rejected for the MVP: it adds a second deployment surface for a call that is one HTTP request in either language. Python earns its seat in the evaluation layer instead (see the Evaluation section).

### Recommended AI output mode

Use structured output where available:

- OpenAI Responses API with image input and Structured Outputs.
- Bedrock / Claude equivalent if RMIT provides that route.
- Always validate final output with Zod before saving.

Critical rule:

> The model is allowed to say uncertain or unreadable. It should not guess.

### OCR/vision pipeline for MVP

Recommended simple pipeline:

```text
Upload document
-> store original file
-> create extraction_run(status = queued)
-> call AI/OCR provider
-> validate Contract JSON with Zod
-> save extraction result
-> show confirm screen
-> user confirms/corrects
-> generate task/reminder
```

Optional later improvements:

- blur detection before sending image to AI
- OCR second opinion
- model comparison experiments
- synthetic test documents
- human-labelled evaluation set

## 8. File Storage

Do not store uploaded document files directly inside Postgres.

Recommended:

- Supabase Storage private bucket: `documents`
- Store only `storage_path` and metadata in Postgres.
- Use signed URLs or authenticated storage access.
- Apply RLS policies to storage objects.

Suggested storage path:

```text
documents/{user_id}/{document_id}/original.{ext}
documents/{user_id}/{document_id}/preview.webp
```

### Upload path (browser to Storage, not through the API)

Vercel route handlers cap request bodies at 4.5 MB, and phone photos regularly exceed that. Uploads therefore go straight to Supabase Storage:

1. The browser asks our API for a signed upload URL (auth and quota are checked there).
2. The browser PUTs the file directly to Storage with that URL.
3. The API then creates the document row and runs normalization server-side on the stored file.

The architecture diagram shows this as the direct "signed upload" arrow from the browser to Storage.

### Upload normalization (after storage, before anything else sees the image)

Normalize every upload in one pass:

- HEIC: do not list image/heic in the upload accept attribute, so iOS Safari converts to JPEG client-side on its own; for files that still arrive as HEIC, decode with heic-convert and hand the result to sharp (sharp's prebuilt binaries ship no HEIC decoder)
- apply EXIF orientation, then strip it
- downscale the longest edge to 1568 px (the standard vision tier's long-edge cap; adjust if the RACE model's tier differs) and store a webp working copy alongside the original

One code path, two wins and one decision: AI payloads shrink roughly 10x (faster and cheaper calls), photos stop arriving sideways, and storage still grows by roughly the original's size per upload, so decide at Milestone 2 how long originals are retained alongside the working copy within the 1 GB budget.

## 9. Background Jobs

Document extraction should not block the browser request for too long.

### MVP approach

Use:

- `extraction_runs.status`
- Next.js route handler to start extraction
- polling from UI every few seconds

Statuses:

```text
queued
processing
needs_review
failed
user_confirmed
```

Run-level status tracks the pipeline; field-level status (confirmed / uncertain / unreadable) is the model's own assertion about one field. The final run state is named user_confirmed so the two vocabularies cannot be confused: only the user confirms, the model only asserts.

The route wraps the provider call in try/catch and writes failed plus an error message on any exception. The hourly pg_cron job doubles as a sweeper: any run stuck in processing for more than 10 minutes is marked failed, so the UI never polls forever.

### Extraction venue (measured, not assumed)

Vercel Hobby route handlers can run up to 300 seconds with maxDuration set, which comfortably covers a single vision-LLM call on a downscaled image. So the MVP runs extraction inside the route handler, and the reason to ever move it would be reliability and user experience, not a timeout ceiling.

If decoupling becomes necessary, the queue already exists: extraction_runs is the queue table, and the same hourly sweep that fails stuck runs can retry them. No new infrastructure is named until measured latency demands it.

BullMQ + Redis stays out of scope: it needs a persistent worker process, which serverless hosting does not provide. A free Redis tier exists (Upstash), but that does not change the worker problem.

### Reminders and notifications

Vercel Hobby cron fires at most once per day, which is useless for reminders. The scheduler therefore lives in Postgres, and no second runtime is introduced:

- pg_cron runs an hourly job
- the job calls net.http_post (pg_net) against an internal Next.js route, /api/internal/reminders/scan, authenticated with a shared secret header
- the route scans due tasks, writes notification rows, and sends email if the email channel is unblocked (see below)

Channels for the MVP, in honesty order:

- in-app notification center (the notifications table plus an unread badge): the only channel that is guaranteed free and unblocked
- email: blocked until the team controls a verified sender. Resend's free tier only sends from onboarding@resend.dev to the account owner's own address until a custom domain is verified, and the Supabase default mailer only delivers to team members' own addresses. Neither reaches a real user at $0 without a domain. Record this in the A1 risk register; a free SMTP provider with single-sender verification is the likely unblock.
- web push: later; the PWA manifest is its prerequisite

## 10. Deployment Options

### Recommended for MVP: Vercel + Supabase

Best if the goal is a fast prototype:

- Vercel hosts Next.js.
- Supabase hosts database, auth, storage.
- RMIT/client API keys are stored in environment variables.

Pros:

- fastest setup
- minimal server management
- good demo experience
- easy preview deployments

Cons:

- must confirm data/privacy requirements
- may not satisfy client/RMIT hosting constraints

### Free tier operations (read before demo week)

- Vercel Hobby has exactly one seat. The project lives under one team-owned account; teammates deploy by merging to main through the GitHub integration, and nobody deploys from a personal Vercel login. Hobby is also licensed for non-commercial use only: the deployed URL is a coursework demo, not the handover target.
- The handover artifact is the Docker Compose stack, built and verified once at a scheduled handover rehearsal (around week 10), not maintained continuously as a second deployment path. Any commercial continuation after the semester needs paid hosting anyway.
- Supabase free projects pause after about a week of low activity, and a weekly ping has no margin. A daily GitHub Actions cron does a real database write (insert into a small heartbeat table). A paused database on demo day is the classic failure of this stack.
- Preview deployments all point at the single production Supabase project (database branching is a paid feature): a preview is production data, say it out loud in the team. The development default is the Supabase CLI local stack (supabase start) in Docker, with migrations tested locally before they touch the cloud project.
- Register Vercel, Supabase and any SMTP provider under a team address, not anyone's personal account. The project must hand over cleanly at semester end.

### Alternative: Docker self-hosted

Use if client/RMIT requires controlled hosting:

```text
Docker Compose
  nextjs-app
  postgres
  redis optional
  minio optional
```

Pros:

- more control
- easier to explain as portable deployment
- no vendor lock-in

Cons:

- slower setup
- team must manage auth/session/storage more carefully
- deployment is more work

## 11. Evaluation And Experiments (Python, Offline)

The app runtime is TypeScript end to end. Alongside it, the repo carries an offline evaluation workspace in Python (managed with uv), because the tooling for this layer lives in Python: image degradation libraries such as Augraphy, opencv and Pillow for image quality measurement, pytest for harness discipline.

What it is for:

- scoring extraction output against labelled fixtures: per-field accuracy, and false positives on documents that require no action
- comparing providers, models and prompts before changing adapter defaults
- generating and checking synthetic test fixtures (the AI/OCR section already lists these as a planned improvement)

The boundary is the Contract JSON: the harness consumes exactly what the adapter emits. It is not deployed, costs nothing to host, and any team member can run it locally. Its results feed back into the app only as configuration: prompt text, model choice, few-shot examples.

One promotion this implies: the Contract JSON should move out of this document into code. Define it once as a Zod schema, generate a JSON Schema export for the Python side, and version changes through pull requests. A contract that lives as an example in a stack document will drift; a contract that lives as code fails loudly.

## 12. Testing Strategy

Use three levels:

| Test type | Tool | What to test |
|---|---|---|
| Schema/unit tests | Vitest | Contract JSON validation, due-date parsing, status transitions. |
| Component tests | Vitest + Testing Library | Confirm box, task card, reminder form, role-based UI states. |
| E2E tests | Playwright | Login, upload document, extraction result appears, user confirms, task/reminder created. |

All tests run against the mock provider in CI, so results stay deterministic and free.

Minimum tests before demo:

- User can sign up/sign in.
- User can upload a document.
- Extraction result can be shown as uncertain.
- User can correct a due date.
- Confirming creates a task/reminder.
- Another user cannot view the document.
- Admin/operator views do not expose private document content unless permission allows it.

## 13. Suggested Folder Structure

```text
day-keeper-group-1/
  src/
    app/
      (auth)/
      (dashboard)/
      api/
    components/
      ui/
      documents/
      tasks/
      reminders/
      admin/
    lib/
      auth/
      supabase/
      validation/
      ai/
      storage/
    server/
      documents/
      tasks/
      reminders/
      extraction/
    types/
  supabase/
    migrations/
    seed.sql
  tests/
    e2e/
    unit/
  docs/
    architecture/
    ai-prompts/
    meeting-minutes/
```

## 14. Team Workflow

Use GitHub with:

- branch per feature
- pull requests
- code review before merge
- GitHub Issues or Jira ticket link in PR description
- AI prompt logs saved in `docs/ai-prompts/`

Recommended branch naming:

```text
feature/auth-login
feature/document-upload
feature/extraction-contract
feature/confirm-box
feature/task-reminders
feature/admin-dashboard
fix/rls-document-access
```

Recommended PR checklist:

```markdown
## What changed

## How to test

## AI usage
- Prompt/tool used:
- What AI generated:
- What I changed/verified:

## Jira ticket
```

## 15. What Not To Do

Avoid these choices for Phase 1:

- Do not build a native mobile app.
- Do not make the product a chatbot-first interface.
- Do not put uploaded files directly in Postgres.
- Do not call AI APIs directly from the frontend.
- Do not create a microservice architecture at the beginning.
- Do not introduce Module 2 and Module 3 into the core MVP before Module 1 and Module 4 work.
- Do not automatically execute high-risk actions from AI output without user confirmation.
- Do not rely only on model confidence scores.
- Do not use personal API keys or personal paid cloud resources.

## 16. Recommended MVP Milestones

### Milestone 1: Project foundation

- Next.js app created.
- Supabase project created.
- Auth working.
- Basic dashboard layout.
- GitHub/Jira workflow ready.

### Milestone 2: Document upload and archive

- User uploads file (signed upload URL, direct to Storage).
- File stored in private bucket.
- Upload normalized after storage (HEIC, EXIF orientation, downscale).
- Document record created.
- User sees document archive.
- Retention rule for originals decided (keep both within the 1 GB budget, or discard originals after confirmation).

### Milestone 3: Extraction contract

- Contract JSON schema created with Zod.
- Mock extraction provider implemented.
- Extraction result saved to database.
- Exit check: as soon as real provider keys arrive, measure real extraction latency, then set the route's maxDuration and the downscale target on measured numbers.

### Milestone 4: Confirm box

- User sees extracted fields.
- Uncertain/unreadable fields are highlighted.
- User can correct values.
- Corrections are stored.

### Milestone 5: Tasks and reminders

- Confirmed extraction creates task/reminder.
- User can edit/complete tasks.
- Dashboard shows upcoming deadlines.
- Reminder delivery works end to end: pg_cron job, notifications table, unread badge.

### Milestone 6: Admin/operator prototype

- Admin dashboard exists.
- Platform operator can see system status.
- Organization features remain clearly marked as future/optional unless client prioritizes them.

## 17. Decision Summary

The best default stack is:

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
Supabase Auth
Supabase Postgres
Supabase Storage
Zod
OpenAI/RMIT Bedrock provider adapter
Vitest
Playwright
Vercel or Docker deployment
Offline Python evaluation workspace (uv)
```

The most important design decision is not the exact model provider. It is this:

> DayKeeper must be built around user confirmation, permissioned access, and structured extraction data.

If the team gets those foundations right, the AI model can be swapped later.

## 18. Sources Checked

- Next.js docs: https://nextjs.org/docs
- Tailwind CSS with Next.js: https://tailwindcss.com/docs/installation/framework-guides/nextjs
- shadcn/ui Next.js installation: https://ui.shadcn.com/docs/installation/next
- Supabase Auth docs: https://supabase.com/docs/guides/auth
- Supabase Row Level Security docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage access control docs: https://supabase.com/docs/guides/storage/security/access-control
- PostgreSQL JSON/JSONB docs: https://www.postgresql.org/docs/current/datatype-json.html
- OpenAI image/vision docs: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI Structured Outputs docs: https://developers.openai.com/api/docs/guides/structured-outputs
- Supabase background tasks docs: https://supabase.com/docs/guides/functions/background-tasks
- Auth.js Prisma Adapter docs: https://authjs.dev/getting-started/adapters/prisma
- Zod docs: https://zod.dev/
- Playwright docs: https://playwright.dev/docs/intro
- Vercel cron jobs usage and limits: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel function max duration: https://vercel.com/docs/functions/configuring-functions/duration
- Supabase pg_cron docs: https://supabase.com/docs/guides/database/extensions/pg_cron
- Supabase pricing and free project pausing: https://supabase.com/pricing
- Resend pricing: https://resend.com/pricing
- sharp image processing: https://sharp.pixelplumbing.com/
- heic-convert: https://www.npmjs.com/package/heic-convert
- Supabase pg_net docs: https://supabase.com/docs/guides/database/extensions/pg_net
- Supabase local development: https://supabase.com/docs/guides/local-development
- Vercel function limits (body size): https://vercel.com/docs/functions/limitations
- Resend domain verification: https://resend.com/docs/dashboard/domains/introduction
- Augraphy: https://github.com/sparkfish/augraphy
- uv: https://docs.astral.sh/uv/
