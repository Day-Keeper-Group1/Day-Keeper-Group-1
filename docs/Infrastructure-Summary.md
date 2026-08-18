# Infrastructure Summary

## 1. Purpose

This infrastructure summary describes the technical and operational setup for the DayKeeper Group 1 project. It covers the development environment, code repository, project management tools, communication channels, deployment direction, and hardware/software resources required to deliver the Sprint 1 prototype and support later development.

DayKeeper is being developed as a responsive web application. The Semester 1 prototype focuses on Module 1, Physical Document Intelligence, and Module 4, Unified Archive and Action Engine. The first sprint aims to deliver a vertical slice where a user uploads a photo of a physical document, the system extracts key information, the user reviews and confirms the extracted data, and the confirmed action becomes a task with a due date.

## 2. Development Environment Setup

The project is implemented as a web application using a modern TypeScript-based frontend stack.

| Area | Selected / Proposed Setup | Purpose |
|---|---|---|
| Framework | Next.js with App Router | Full-stack React framework for routes, layouts, protected pages, and future API handlers |
| Language | TypeScript | Provides safer data models, typed components, and clearer interfaces between features |
| UI Styling | Tailwind CSS | Supports responsive layouts and consistent styling |
| UI Components | shadcn/ui and lucide-react | Provides reusable interface components and icons for dashboards, forms, navigation, and status displays |
| Package Manager | npm | Used for installing dependencies and running project scripts |
| Code Quality | ESLint | Used to check code quality and framework conventions |
| Local Development | Local Next.js development server | Developers run the app locally before submitting changes |
| Environment Variables | `.env.example` and local `.env.local` | Keeps required configuration documented while preventing secrets from being committed |

The current local development commands are:

```bash
npm install
npm run dev
npm run build
npm run lint
```

The application runs locally at:

```text
http://localhost:3000
```

Sensitive configuration values such as database URLs, storage keys, authentication keys, and AI provider credentials must not be committed to GitHub. Developers should copy `.env.example` to `.env.local` and fill in their own local values when required.

## 3. Database, Authentication, and Storage Setup

The recommended database and backend service setup is Supabase.

| Area | Proposed Setup | Purpose |
|---|---|---|
| Authentication | Supabase Auth | Handles user registration, login, sessions, and future role-based access |
| Database | Supabase Postgres | Stores users, documents, extraction results, tasks, reminders, and audit logs |
| Authorization | Postgres Row Level Security | Protects sensitive user document data at database level |
| File Storage | Supabase Storage private bucket | Stores uploaded document photos securely outside the database |
| Data Validation | Zod / TypeScript schemas | Validates AI extraction output before saving or displaying it |

The expected core data areas are:

```text
profiles
documents
extraction_runs
extracted_fields
tasks
reminders
audit_logs
```

For Sprint 1, the team may begin with mock data and a mock AI extraction provider while the real database and AI provider access are confirmed. This allows frontend, review, and task-generation flows to be developed without waiting for final infrastructure approval.

## 4. AI/OCR Provider Setup

The project should use a provider adapter approach for AI/OCR extraction. This prevents the application from being locked into one provider too early.

The planned extraction flow is:

```text
Photo upload
-> store document record
-> create extraction run
-> call mock or real AI/OCR provider
-> validate extracted fields
-> show review screen
-> user confirms or corrects data
-> create task/reminder
```

The minimum extracted fields for Sprint 1 are:

```text
document type
issuer
action required
due date
amount, if relevant
reference number
```

The AI provider should be treated as replaceable. Possible future providers include RMIT-provided resources, OpenAI-compatible vision models, Claude/Bedrock, or another approved OCR/vision service. Personal paid API keys should not be used for the project.

## 5. Code Repository Setup

The project uses GitHub for version control and collaborative development.

Repository:

```text
https://github.com/ZhenyingCui-Saiii/Day-Keeper-Group-1
```

The repository contains the Next.js application source code, documentation, prototypes, and setup instructions.

Recommended repository structure:

```text
src/
  app/
  components/
  lib/
  server/
  types/

docs/
  project-description.md
  technical documents
  prototype/
  meeting records

public/
  static assets
```

Recommended branching strategy:

| Branch Type | Example | Purpose |
|---|---|---|
| Main branch | `main` | Stable project branch |
| Feature branch | `feature/document-upload` | New feature development |
| Fix branch | `fix/build-error` | Bug fixes |
| Documentation branch | `docs/infrastructure-summary` | Documentation updates |

Pull requests should be used before merging important changes into `main`. Each pull request should include a short description, testing notes, and any related Jira task.

Suggested pull request checklist:

```text
What changed:
How to test:
Related Jira ticket:
Known limitations:
```

As DevOps, Sai is responsible for supporting the repository workflow, environment setup, deployment process, and build reliability. Feature owners remain responsible for fixing feature-specific bugs that cause build or deployment failures.

## 6. CI/CD and Deployment Setup

The planned deployment direction is Vercel for the Next.js web application and Supabase for authentication, database, and storage.

| Area | Proposed Setup | Purpose |
|---|---|---|
| Hosting | Vercel | Hosts the Next.js responsive web application |
| Backend Services | Supabase | Provides Auth, Postgres, and Storage |
| CI/CD | GitHub Actions or Vercel build checks | Runs automated checks before deployment |
| Build Validation | `npm run build` | Confirms the application can compile successfully |
| Lint Validation | `npm run lint` | Checks code quality and framework conventions |

A basic CI/CD workflow should check:

```text
install dependencies
run lint
run build
report failure before deployment
```

The deployment should use environment variables configured in the hosting platform rather than hardcoded secrets. A deployed demo URL should be shared with the team, supervisor, and client when the Sprint 1 prototype is ready.

If Vercel or Supabase is not approved by RMIT/client requirements, the fallback option is a Docker-based deployment with a hosted or self-managed PostgreSQL database and object storage.

## 7. Project Management Setup

The team uses Jira to manage the product backlog, sprint backlog, user stories, task assignments, and sprint progress.

Jira should contain:

```text
product backlog items
Sprint 1 backlog
technical enabling tasks
assigned owners
story points
acceptance criteria
status tracking
```

Sprint 1 includes both user-facing stories and enabling technical work. The main Sprint 1 goal is to deliver one working vertical slice from document photo upload to confirmed task creation.

Sprint 1 technical enabling work includes:

```text
project skeleton
schema design
API/data contract
mock extraction provider
test fixture setup
deployment skeleton
```

The team uses Scrum as the delivery methodology. Sprint planning, backlog refinement, daily coordination, sprint review, and retrospective activities are coordinated by the Scrum Master.

## 8. Communication Setup

The team uses multiple communication channels depending on the purpose.

| Channel | Purpose |
|---|---|
| Microsoft Teams | Main communication with team, supervisor, and project-related discussion |
| Email | Formal communication with supervisor and client |
| Jira | Sprint tasks, backlog tracking, and progress visibility |
| GitHub | Code review, commits, repository management, and technical collaboration |
| Meetings | Sprint planning, stand-ups, supervisor meetings, and client clarification |

Meeting agendas and meeting minutes are required for formal meetings, especially client meetings. Decisions, blockers, and action items should be documented so the team can show effective collaboration and project management.

## 9. Hardware and Software Needs

Each team member requires a laptop or desktop capable of running the local development environment.

Minimum software requirements:

```text
Node.js
npm
Git
Visual Studio Code or equivalent IDE
Modern web browser, such as Chrome or Edge
GitHub account
Jira access
Microsoft Teams access
```

Additional services required or proposed:

```text
GitHub repository access
Vercel account or deployment access
Supabase project access
Approved AI/OCR provider access
Synthetic test document set
```

Hardware needs are moderate because the prototype is a web application. However, testing the document upload flow should include both desktop and mobile-like scenarios. At least one mobile phone camera or mobile browser should be used to test the photo upload experience.

## 10. Security and Privacy Considerations

DayKeeper may process sensitive personal documents such as bills, government letters, medical letters, or service notices. The infrastructure must therefore follow basic privacy and security principles.

Key rules:

```text
Do not commit secrets or API keys.
Do not use personal paid API keys for production-like work.
Store uploaded files in private storage, not directly in the database.
Use authenticated access for user documents.
Use role-based access for admin features.
Do not expose private document content in the platform operator dashboard.
Use synthetic documents for Sprint 1 testing unless the client provides approved samples.
```

The system should make AI uncertainty visible. Extracted values should not become tasks or reminders until the user has reviewed and confirmed them.

## 11. Current Status and Open Items

Current status:

```text
Next.js project scaffold exists.
TypeScript, Tailwind CSS, shadcn/ui, and lucide-react are included.
GitHub repository exists.
Basic documentation and prototype materials exist.
Sprint 1 planning identifies deployment skeleton as enabling work.
Mock extraction is planned while real AI/OCR access is confirmed.
```

Open items to confirm:

```text
Whether the team will use Vercel for deployment.
Whether the team will use Supabase for Auth, Postgres, and Storage.
Which AI/OCR provider will be approved by RMIT or the client.
Whether original uploaded document files must be stored long-term.
Whether GitHub Actions or Vercel build checks will be used as the primary CI gate.
Whether Jira has been fully configured and all members have access.
```

## 12. DevOps Responsibility

The DevOps role is responsible for making sure the project can be built, tested, deployed, and reproduced reliably.

For this project, Sai's DevOps responsibilities include:

```text
maintaining environment setup instructions
supporting GitHub repository workflow
documenting branching strategy
preparing deployment configuration
setting up basic CI/CD checks
ensuring build and lint commands are available
managing deployment-related environment variables
supporting integration of frontend, backend, storage, and AI services
```

Feature-specific defects remain the responsibility of the relevant feature owner, with DevOps supporting integration and deployment troubleshooting.
