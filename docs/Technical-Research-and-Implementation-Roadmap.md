# DayKeeper Technical Research and Implementation Roadmap

> **Superseded in part.** This document predates the architecture decision
> records in `docs/architecture/`. Where the two disagree, **the ADRs win**:
> this project does not use Supabase Auth (ADR 002), has no migrations and runs
> Postgres locally in Docker (ADR 003), and the extraction contract is six
> fields, not seven (ADR 004). The rest of this document still stands.

Date: 6 August 2026  
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
- User registration and secure access
- Admin dashboard

Future scope:

- Module 2: Email Intelligence
- Module 3: Voice and Conversation Intelligence

## 3. Readiness Assessment

The project can start **technical research and project foundation work now**.

The project should not start full feature development until these are agreed:

- MVP scope for Phase 1
- Authentication and authorization approach
- Whether original uploaded documents must be stored
- Extraction Contract JSON
- AI/OCR provider strategy
- Database schema draft
- User confirmation workflow

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
Supabase Auth
Supabase Postgres
Supabase Storage
Postgres Row Level Security
Zod
React Hook Form
OpenAI / Claude / RMIT Bedrock provider adapter
Vitest
Playwright
Vercel or Docker deployment
```

The main reason is speed plus safety. Supabase gives authentication, Postgres, private storage, and Row Level Security in one system. Next.js gives the responsive web app, dashboard UI, and server-side API surface.

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
- Confirm whether original uploaded documents must be saved.

### Step 1: Architecture Decision Records

Goal:

- Make explicit decisions about framework, auth, database, file storage, AI provider strategy, and deployment.
- Record the reasons so the final report can explain the team's engineering choices.

Outputs:

- `docs/architecture/adr-001-web-framework.md`
- `docs/architecture/adr-002-auth-and-permissions.md`
- `docs/architecture/adr-003-data-storage.md`
- `docs/architecture/adr-004-extraction-contract.md`

Possible technology stack:

- Markdown ADRs
- Mermaid diagrams
- GitHub pull requests for review

Code readiness:

- No feature code yet.
- This prepares the team to scaffold safely.

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
- pnpm
- Tailwind CSS
- ESLint
- Prettier
- shadcn/ui
- lucide-react

Code readiness:

- This is the first safe coding step.
- It should not include business logic yet.

Suggested folder structure:

```text
src/
  app/
  components/
  lib/
  server/
  types/
docs/
  architecture/
  ai-prompts/
  meeting-minutes/
supabase/
  migrations/
tests/
  unit/
  e2e/
```

### Step 3: Authentication and Authorization Research

Goal:

- Decide how users and admins log in.
- Decide who can access each document, task, reminder, and admin view.

Outputs:

- Auth flow diagram
- Role model
- RLS policy draft
- Auth implementation ticket list

Recommended option:

- Supabase Auth
- Supabase SSR helpers for Next.js
- Postgres Row Level Security

Alternative option:

- Auth.js
- Prisma
- Self-hosted PostgreSQL

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

- Start with Supabase Auth proof of concept only after the team accepts the auth direction.

### Step 4: Database and Storage Design

Goal:

- Define how DayKeeper stores users, documents, extraction results, tasks, reminders, and audit logs.

Outputs:

- Entity relationship diagram
- Database schema draft
- Migration plan
- Storage bucket policy draft

Possible technology stack:

- Supabase Postgres
- SQL migrations
- JSONB for extraction payloads
- Supabase Storage private bucket
- Postgres Row Level Security

Core tables:

```text
profiles
documents
extraction_runs
extracted_fields
tasks
reminders
audit_logs
ai_prompt_logs
```

Storage rule:

- Store uploaded files in private object storage.
- Store file metadata and storage paths in Postgres.
- Do not store raw file binaries in database tables.

Code readiness:

- Schema draft can be written before UI work.
- Real migrations should wait until auth and storage choice is confirmed.

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

Recommended field status values:

```text
confirmed
uncertain
unreadable
```

Core fields:

```text
document_type
issuer
action_required
due_date
amount
reference
summary
```

Code readiness:

- This is safe to start early because it does not depend on real AI keys.
- The team can build UI and tests using mock extraction data.

### Step 6: Document Photo Upload Flow

Goal:

- Let users upload a photo or existing document file through the responsive website.
- Keep the flow clear for mobile users.

Outputs:

- Upload page
- File validation
- Preview before processing
- Document status display

Possible technology stack:

- Next.js client components
- Browser file input with camera capture support
- Supabase Storage
- Zod file metadata validation
- shadcn/ui form components

Important wording:

- Use "photo upload" instead of "scan" in the UI and docs unless the client later confirms scanner support.

Code readiness:

- Start after project foundation and storage design.

### Step 7: AI/OCR Provider Research

Goal:

- Compare realistic AI/OCR options without locking the app to one provider too early.
- Confirm what RMIT RACE, AWS Bedrock, OpenAI, or Claude access is available.

Outputs:

- Provider comparison table
- Cost and access notes
- Data privacy notes
- Adapter interface
- Experiment plan

Possible technology stack:

- OpenAI vision model through Responses API
- Anthropic Claude vision through Bedrock or direct API
- AWS Textract if document OCR is prioritized
- Tesseract only for local baseline experiments
- Provider adapter pattern

Recommended design:

```text
DocumentExtractionProvider
  mock provider
  openai provider
  bedrock provider
  optional ocr baseline provider
```

Code readiness:

- Start with mock provider.
- Do not use personal paid API keys.
- Real integration waits for RMIT/client resource confirmation.

### Step 8: Review and Confirmation UI

Goal:

- Let the user verify AI-extracted information before tasks are created.
- Make uncertainty visible and non-threatening.

Outputs:

- Confirm box page
- Editable extracted fields
- Uncertain/unreadable highlighting
- Save corrections
- Generate task only after confirmation

Possible technology stack:

- React Hook Form
- Zod resolver
- shadcn/ui forms
- Tailwind CSS
- Supabase database updates

Core principle:

- A confidently wrong value is worse than asking the user to check.

Code readiness:

- Start after Contract JSON and mock extraction provider exist.

### Step 9: Task and Reminder Engine

Goal:

- Turn confirmed obligations into tasks and reminders.
- Let users manage open, upcoming, overdue, and completed tasks.

Outputs:

- Task list
- Task detail page
- Reminder records
- Overdue state
- Complete/edit/dismiss actions

Possible technology stack:

- Next.js server actions or route handlers
- Supabase Postgres
- Date utilities
- In-app notification table
- Optional scheduled jobs later

MVP reminder approach:

- Store reminder times in database.
- Show reminders in-app.
- Email reminders can be Should/Could unless confirmed as Must.

Code readiness:

- Start after user confirmation flow works.

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
- Supabase Auth roles
- RLS policies
- SQL aggregate queries
- shadcn/ui tables/charts

Phase 1 admin scope:

- Platform operator dashboard
- System health
- Usage counts
- Processing errors

Future admin scope:

- Organization admin
- Worker access to client records
- Service authorization model

Code readiness:

- Start only after role model is agreed.

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
- Supabase local or test project

Minimum tests:

- User can register and log in.
- User can upload a photo.
- Mock extraction returns Contract JSON.
- Uncertain fields require review.
- User correction creates a confirmed task.
- Another user cannot read the document.
- Admin cannot see private document content unless explicitly allowed.

Code readiness:

- Tests should start as soon as contracts and routes exist.

### Step 12: Deployment Research

Goal:

- Decide whether the prototype is deployed through Vercel/Supabase or a more controlled RMIT/client environment.

Outputs:

- Deployment decision
- Environment variable list
- Demo URL plan
- Data handling note

Possible technology stack:

- Vercel
- Supabase hosted project
- Docker Compose
- Self-hosted Postgres
- MinIO or S3-compatible storage

Recommendation:

- Use Vercel + Supabase for fastest MVP if allowed.
- Keep Docker Compose as fallback if the client/RMIT requires self-hosting.

Code readiness:

- Can prepare `.env.example` early.
- Do not deploy with real private documents during early tests.

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
- Supabase
- Auth
- Database design
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
- Auth and RLS design
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
- Clear status labels: `needs review`, `confirmed`, `overdue`, `completed`.
- Large enough tap targets on mobile.
- Strong contrast for important actions.
- Do not hide uncertainty.
- Do not overload vulnerable users with dense screens.
- Make the next action obvious.
- Every generated task must link back to the source document.

### Team rule for AI-assisted UI work

When Taste Skill helps generate or review UI, record the prompt in:

```text
docs/ai-prompts/
```

Record:

- Prompt/tool used
- Screen or component affected
- What AI generated
- What the developer changed or verified
- Whether Taste Skill was used as a design rule

This supports the final GenAI declaration and supervisor expectations.

## 7. Recommended First Technical Research Tasks

These tasks can start before full coding:

| Task | Owner suggestion | Output |
|---|---|---|
| Compare Supabase Auth vs Auth.js | Sai / XC | ADR draft |
| Draft database schema | Jason / Sai | ERD and table list |
| Draft Contract JSON with Zod shape | Sai / Jason | Schema document |
| Research AI/OCR provider options | Sai / Jason | Provider comparison |
| Review UI prototype with accessibility focus | XC / Hiruni | UI notes |
| Define admin dashboard MVP | Gerry / Hiruni | Admin scope note |
| Clean backlog contradictions | Gerry / team | Jira-ready backlog |

## 8. Recommended Coding Order

Once the team is ready to start implementation, use this order:

1. Scaffold Next.js project.
2. Add Tailwind and base UI components.
3. Add Supabase client and `.env.example`.
4. Implement auth pages.
5. Draft database migrations.
6. Add protected dashboard shell.
7. Add mock document upload flow.
8. Add Contract JSON and mock extraction.
9. Add review/confirm UI.
10. Generate tasks from confirmed fields.
11. Add in-app reminders.
12. Add basic admin dashboard.
13. Add tests.
14. Add real AI/OCR provider after resources are confirmed.

## 9. Final Recommendation

The team should begin with technical research and foundation work, not feature-heavy implementation.

Best immediate next step:

```text
Write ADRs for auth, data storage, AI extraction contract, and deployment.
```

Best first code step after ADRs:

```text
Scaffold Next.js + TypeScript + Tailwind, then implement authentication and the dashboard shell.
```

Taste Skill should be used later as a frontend polish assistant, not as the main technical decision-maker for DayKeeper.

## 10. Sources Checked

- Taste Skill docs: https://www.tasteskill.dev/docs
- Taste Skill GitHub repository: https://github.com/Leonxlnx/taste-skill
- Next.js docs: https://nextjs.org/docs
- Supabase Auth docs: https://supabase.com/docs/guides/auth
- Supabase Row Level Security docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage access control docs: https://supabase.com/docs/guides/storage/security/access-control
- PostgreSQL JSON types docs: https://www.postgresql.org/docs/current/datatype-json.html
- OpenAI image and vision docs: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI Structured Outputs docs: https://developers.openai.com/api/docs/guides/structured-outputs
- Auth.js Prisma Adapter docs: https://authjs.dev/getting-started/adapters/prisma
- Zod docs: https://zod.dev/
- Playwright docs: https://playwright.dev/docs/intro
