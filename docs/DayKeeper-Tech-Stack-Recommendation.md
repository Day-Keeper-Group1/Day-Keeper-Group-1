# DayKeeper Group 1 - Technical Stack Recommendation

> **Superseded in part.** This document predates the architecture decision
> records in `docs/architecture/`. Where the two disagree, **the ADRs win**:
> this project does not use Supabase Auth (ADR 002), has no migrations and runs
> Postgres locally in Docker (ADR 003), and the extraction contract is six
> fields, not seven (ADR 004). The rest of this document still stands.

Date: 31 July 2026  
Author: Sai / Group 1 working note  
Status: Draft for team discussion

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
| AI/OCR integration | **Provider adapter layer** using RMIT/AWS Bedrock or OpenAI-compatible API | Do not lock the app to one model provider before resource access is confirmed. |
| AI output contract | **Zod schema + JSON Schema / Structured Output** | Extraction output must be predictable: fields, statuses, evidence, and user-confirmation state. |
| Background work | **Start simple: Next.js route handler + status table. Later: Supabase Edge Function background tasks or BullMQ + Redis** | OCR/LLM extraction can take time; UI should show processing status instead of blocking. |
| Testing | **Vitest + Playwright** | Unit/schema tests for contracts and E2E tests for upload-confirm-reminder flows. |
| Deployment | **Vercel + Supabase for MVP**, or **Docker self-hosting** if client/RMIT requires it | Vercel/Supabase is fastest. Docker path is safer if hosting must be controlled by RMIT/client. |

Short version: **Next.js + TypeScript + Supabase Auth/Postgres/Storage + Tailwind/shadcn + Zod + Playwright.**

## 2. Project Requirements That Drive the Stack

The technology choices should fit these product requirements:

- The product is a **website** usable on mobile, tablet, and desktop.
- Phase 1 focuses on:
  - Module 1: document upload / scan intelligence.
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
audit_logs
ai_prompt_logs
```

Important rule:

> Authentication answers "who is this user?" Authorization answers "what is this user allowed to see or do?"

For this project, authorization is more important than usual because documents may include bills, medical letters, government forms, and personal information.

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
  "document_type": {
    "value": "utility_bill",
    "raw_text": "Electricity bill",
    "status": "confirmed",
    "evidence": {
      "page": 1,
      "bbox": [10, 20, 200, 80]
    }
  },
  "issuer": {
    "value": "Energy Provider",
    "raw_text": "Energy Provider Pty Ltd",
    "status": "confirmed",
    "evidence": {
      "page": 1,
      "bbox": [15, 25, 220, 60]
    }
  },
  "action_required": {
    "value": "Pay bill",
    "raw_text": "Please pay by the due date",
    "status": "confirmed",
    "evidence": {
      "page": 1,
      "bbox": [20, 300, 500, 80]
    }
  },
  "due_date": {
    "value": "2026-08-15",
    "raw_text": "15/08/26",
    "status": "uncertain",
    "evidence": {
      "page": 1,
      "bbox": [300, 450, 120, 40]
    }
  },
  "amount": {
    "value": "125.40",
    "raw_text": "$125.40",
    "status": "confirmed",
    "evidence": {
      "page": 1,
      "bbox": [320, 500, 120, 40]
    }
  },
  "reference": {
    "value": "REF123456",
    "raw_text": "Reference: REF123456",
    "status": "confirmed",
    "evidence": {
      "page": 1,
      "bbox": [30, 540, 220, 40]
    }
  }
}
```

Use `Zod` in the codebase to validate this at runtime. TypeScript alone is not enough because AI output and API responses are untrusted runtime data.

## 7. AI/OCR Stack

### Recommended design: provider adapter

Do not directly scatter OpenAI/Claude/Bedrock calls across the app. Create one interface:

```ts
export interface DocumentExtractionProvider {
  extract(input: {
    documentId: string
    imageUrl: string
    documentHint?: string
  }): Promise<ContractJson>
}
```

Then implement adapters:

```text
providers/openai-extraction.ts
providers/bedrock-extraction.ts
providers/mock-extraction.ts
```

Use `mock-extraction.ts` first so frontend and backend can be developed before real API keys arrive.

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
confirmed
```

### Better later approach

If extraction becomes slow or unreliable, use:

- Supabase Edge Function background tasks, if staying in Supabase
- BullMQ + Redis, if self-hosting Node workers

Do not start with BullMQ unless you already know deployment will support Redis. It adds operational overhead.

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

## 11. Testing Strategy

Use three levels:

| Test type | Tool | What to test |
|---|---|---|
| Schema/unit tests | Vitest | Contract JSON validation, due-date parsing, status transitions. |
| Component tests | Vitest + Testing Library | Confirm box, task card, reminder form, role-based UI states. |
| E2E tests | Playwright | Login, upload document, extraction result appears, user confirms, task/reminder created. |

Minimum tests before demo:

- User can sign up/sign in.
- User can upload a document.
- Extraction result can be shown as uncertain.
- User can correct a due date.
- Confirming creates a task/reminder.
- Another user cannot view the document.
- Admin/operator views do not expose private document content unless permission allows it.

## 12. Suggested Folder Structure

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

## 13. Team Workflow

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

## 14. What Not To Do

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

## 15. Recommended MVP Milestones

### Milestone 1: Project foundation

- Next.js app created.
- Supabase project created.
- Auth working.
- Basic dashboard layout.
- GitHub/Jira workflow ready.

### Milestone 2: Document upload and archive

- User uploads file.
- File stored in private bucket.
- Document record created.
- User sees document archive.

### Milestone 3: Extraction contract

- Contract JSON schema created with Zod.
- Mock extraction provider implemented.
- Extraction result saved to database.

### Milestone 4: Confirm box

- User sees extracted fields.
- Uncertain/unreadable fields are highlighted.
- User can correct values.
- Corrections are stored.

### Milestone 5: Tasks and reminders

- Confirmed extraction creates task/reminder.
- User can edit/complete tasks.
- Dashboard shows upcoming deadlines.

### Milestone 6: Admin/operator prototype

- Admin dashboard exists.
- Platform operator can see system status.
- Organization features remain clearly marked as future/optional unless client prioritizes them.

## 16. Decision Summary

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
```

The most important design decision is not the exact model provider. It is this:

> DayKeeper must be built around user confirmation, permissioned access, and structured extraction data.

If the team gets those foundations right, the AI model can be swapped later.

## 17. Sources Checked

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
