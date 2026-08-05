# DayKeeper UI/UX Page Specification

Date: 6 August 2026  
Status: Draft for UI planning before feature implementation  
Audience: DayKeeper Group 1

## 1. Purpose

This document defines the recommended DayKeeper page structure, navigation model, layout direction, responsive behaviour, and Taste Skill usage strategy.

It is written before implementation so the team can avoid uncontrolled UI generation and keep the product consistent with the project requirements.

## 2. Product UI Positioning

DayKeeper should feel like:

> A calm, trustworthy, responsive operational dashboard for vulnerable users to upload document photos, review AI-extracted obligations, and manage tasks and reminders with low cognitive load.

DayKeeper should not feel like:

- a marketing landing page
- a chatbot-first product
- a decorative AI demo
- a dense enterprise admin system
- a generic template dashboard

The interface should make the next action obvious. Users should not need to understand the technology behind OCR, LLMs, or task generation.

## 3. Design Principles

Use these principles across every page:

- Clarity before decoration.
- One primary action per screen.
- Short, plain-language labels.
- Strong visual distinction between `needs review`, `confirmed`, `overdue`, and `completed`.
- Every AI-generated task links back to its source document.
- AI uncertainty must be visible, not hidden.
- Sensitive document content should not appear in admin views unless explicitly permitted.
- Mobile users should be able to complete the upload and review flow comfortably.
- Avoid heavy hero sections inside the authenticated app.
- Use cards only for repeated items or clearly bounded tools.
- Avoid nested cards.
- Avoid decorative gradient blobs, decorative feature panels, and visual noise.

## 4. Visual Direction

Recommended visual tone:

- calm
- trustworthy
- readable
- supportive
- practical

Recommended colour roles:

| Role | Suggested use |
|---|---|
| Primary blue/teal | Main actions, active navigation, trusted system state |
| Amber | Needs review, uncertain fields, attention needed |
| Soft red | Overdue tasks, failed processing, unreadable document fields |
| Green | Confirmed fields, completed tasks |
| Neutral grey | Background, dividers, secondary metadata |

Typography:

- Use clear sans-serif typography.
- Use compact dashboard headings, not oversized hero typography.
- Keep body text readable on mobile.
- Avoid negative letter spacing.
- Avoid long text inside narrow controls.

Layout:

- Desktop: sidebar + topbar + main content region.
- Tablet: collapsible sidebar or compact rail.
- Mobile: top header + bottom navigation.

## 5. Navigation Model

### Desktop Navigation

Use a left sidebar for primary app navigation:

| Nav item | Route | Purpose |
|---|---|---|
| Dashboard | `/dashboard` | Daily overview and next actions |
| Upload | `/documents/new` | Start the document photo upload flow |
| Archive | `/documents` | Search and browse saved documents |
| Tasks | `/tasks` | Manage upcoming, overdue, and completed obligations |
| Admin | `/admin` | Platform operator dashboard; visible only to admin users |

Use a topbar for contextual actions:

- Current page title
- Search entry, initially optional or placeholder
- Notifications button
- User menu
- Sign out

### Mobile Navigation

Use bottom navigation:

| Nav item | Route |
|---|---|
| Home | `/dashboard` |
| Upload | `/documents/new` |
| Archive | `/documents` |
| Tasks | `/tasks` |
| More | `/settings` or mobile menu |

Mobile `Upload` should be visually prominent because document photo upload is the primary entry point.

## 6. Recommended Page Count

MVP route count: **11 pages/routes**

| Group | Count | Pages |
|---|---:|---|
| Public/Auth | 4 | `/`, `/login`, `/register`, `/forgot-password` |
| User App | 6 | `/dashboard`, `/documents/new`, `/documents`, `/documents/[id]`, `/documents/[id]/review`, `/tasks` |
| Settings/Admin | 2 | `/settings`, `/admin` |

Total: **12 route entries** if `/forgot-password` is included. If password reset is deferred, the MVP becomes **11 routes**.

Recommendation:

- Build 11 pages first.
- Keep `/forgot-password` as a simple route or placeholder if password recovery is marked Should-have.

## 7. Page Specifications

### Page 1: Public Entry

Route:

```text
/
```

Purpose:

- Provide a simple entry point for unauthenticated users.
- Explain DayKeeper in one or two plain sentences.
- Route logged-in users directly to `/dashboard`.

Primary users:

- New users
- Demo viewers
- Client/supervisor during presentation

Primary actions:

- Sign in
- Create account

Content:

- Product name: DayKeeper
- Short description
- Primary action button
- Secondary sign-in link

UX direction:

- Keep this page simple.
- It can have more visual polish than the authenticated dashboard, but it should not become a full marketing site.
- Avoid a large decorative feature-card layout.

Responsive layout:

- Desktop: centered content with a subtle supporting visual or product preview.
- Mobile: single-column layout with large tap targets.

Taste Skill usage:

- Use Taste Skill lightly for typography, spacing, and first impression.
- Do not let it turn this into a full marketing landing page unless the team explicitly needs one.

### Page 2: Login

Route:

```text
/login
```

Purpose:

- Let returning users securely access their account.

Primary users:

- Existing end users
- Admin users

Primary actions:

- Log in
- Go to password recovery
- Go to registration

Content:

- Email field
- Password field
- Login button
- Error message area
- Link to registration
- Link to forgot password

UX direction:

- Use clear error messages without revealing whether email or password was incorrect.
- Avoid crowded form layout.
- Keep the page calm and predictable.

Responsive layout:

- Desktop: centered auth panel.
- Mobile: full-width form with comfortable spacing.

Taste Skill usage:

- Use for form polish and spacing only.
- Prioritize trust and readability over visual novelty.

### Page 3: Register

Route:

```text
/register
```

Purpose:

- Let a new user create a secure DayKeeper account.

Primary users:

- New end users

Primary actions:

- Create account
- Return to login

Content:

- Name field
- Email field
- Password field
- Confirm password field
- Optional notification preference starter
- Create account button

UX direction:

- Keep password requirements visible but concise.
- Give immediate feedback for invalid email or weak password.
- Do not overload the user with profile setup during registration.

Responsive layout:

- Desktop: centered form.
- Mobile: single-column form with large inputs.

Taste Skill usage:

- Use for readable form hierarchy and friendly empty states.

### Page 4: Forgot Password

Route:

```text
/forgot-password
```

Purpose:

- Let users recover account access.

Primary users:

- Existing users who forgot their password

Primary actions:

- Request reset link
- Return to login

Content:

- Email input
- Reset link button
- Confirmation message

UX direction:

- Keep the message privacy-safe.
- Do not reveal whether an email exists in the system.

Responsive layout:

- Same as Login and Register.

Taste Skill usage:

- Minimal. This is a utility screen.

### Page 5: Dashboard

Route:

```text
/dashboard
```

Purpose:

- Give users a daily overview of documents needing review, upcoming tasks, overdue tasks, and recent activity.

Primary users:

- End users

Primary actions:

- Upload document photo
- Review uncertain extraction
- Open urgent task

Content:

- Status summary
- Upload document photo entry
- Documents needing review
- Upcoming tasks
- Overdue tasks
- Recent documents
- Optional notification preview

Suggested layout:

```text
Header summary
Primary upload action
Needs review panel
Upcoming tasks panel
Overdue tasks panel
Recent documents list
```

UX direction:

- The user should immediately understand what needs attention today.
- Do not show too many metrics.
- Use plain labels such as "Needs review" instead of technical words like "low confidence".

Responsive layout:

- Desktop: two-column dashboard with priority items on the left and recent/archive items on the right.
- Tablet: stacked two-column groups.
- Mobile: single-column feed ordered by urgency:
  1. Upload
  2. Needs review
  3. Overdue
  4. Upcoming
  5. Recent documents

Taste Skill usage:

- Use strongly here as a UI quality checklist.
- Keep the dashboard restrained, not decorative.
- Avoid generic dashboard metric cards unless they directly help the user act.

### Page 6: Upload Document Photo

Route:

```text
/documents/new
```

Purpose:

- Let users upload a document photo or existing file for processing.

Primary users:

- End users

Primary actions:

- Choose file
- Take photo on mobile
- Preview
- Submit for processing

Content:

- Upload dropzone or file picker
- Mobile camera-compatible file input
- Supported format note
- File size note
- Preview area
- Retake/replace action
- Submit button

UX direction:

- Use "photo upload" wording.
- Keep instructions short.
- Make file validation errors clear and non-technical.
- Do not expose AI/OCR terminology unless needed.

Responsive layout:

- Desktop: upload area beside preview/instructions.
- Mobile: camera-first flow, preview below the file input.

Taste Skill usage:

- Use for interaction clarity, spacing, and empty state quality.
- Avoid making the upload area look like a marketing graphic.

### Page 7: Document Archive

Route:

```text
/documents
```

Purpose:

- Let users search and browse saved documents and their processing status.

Primary users:

- End users

Primary actions:

- Search documents
- Filter by status/type
- Open a document
- Upload new document

Content:

- Search input
- Status filters
- Document list
- Empty state
- Document status badges

Suggested document statuses:

```text
processing
needs review
confirmed
failed
archived
```

UX direction:

- Make "needs review" and "failed" easy to notice.
- Search and filters should not dominate the screen.
- Show useful metadata: issuer, document type, due date, last updated.

Responsive layout:

- Desktop: table or structured list.
- Mobile: stacked document rows/cards.

Taste Skill usage:

- Use for list readability and hierarchy.
- Do not over-style repeated items.

### Page 8: Document Detail

Route:

```text
/documents/[id]
```

Purpose:

- Show the complete saved record for one document.

Primary users:

- End users

Primary actions:

- View original document
- View extracted information
- Open related task
- Go to review page if needed

Content:

- Document title or issuer
- Original document preview
- Extracted information summary
- Related tasks
- Processing status
- Upload date

UX direction:

- Every task should trace back to this document.
- If a document still needs review, the primary action should be "Review extracted information".
- Do not show raw AI output as the main content.

Responsive layout:

- Desktop: document preview on one side, details on the other.
- Mobile: details first if urgent, preview collapsible or below.

Taste Skill usage:

- Use for visual balance between preview and structured information.

### Page 9: Extraction Review and Confirmation

Route:

```text
/documents/[id]/review
```

Purpose:

- Let users confirm or correct AI-extracted information before tasks/reminders are created.

Primary users:

- End users

Primary actions:

- Confirm extracted fields
- Correct uncertain fields
- Mark unreadable fields
- Create task/reminder after confirmation

Content:

- Original document preview
- Extracted field form
- Field status badges
- Evidence/reference text where available
- Correction inputs
- Confirm button
- Cancel/back action

Field statuses:

```text
confirmed
uncertain
unreadable
```

UX direction:

- This is one of the most important pages in DayKeeper.
- The user must feel in control.
- Uncertain fields should be clearly highlighted.
- The page should never imply that unreviewed AI output is final.
- Use supportive language: "Please check this date" instead of "Low confidence".

Responsive layout:

- Desktop: split view:
  - left: original document preview
  - right: editable extracted fields
- Mobile:
  - top: short document summary
  - then: field-by-field review
  - document preview accessible through expand/collapse

Taste Skill usage:

- Use strongly here, but with strict constraints.
- Prioritize clarity, accessible forms, status visibility, and user control.
- Do not add decorative visuals that distract from verification.

### Page 10: Tasks and Reminders

Route:

```text
/tasks
```

Purpose:

- Let users manage obligations generated from documents or manually created.

Primary users:

- End users

Primary actions:

- View overdue tasks
- View upcoming tasks
- Mark task complete
- Edit task
- Open source document

Content:

- Task filters
- Overdue section
- Upcoming section
- Completed section
- Task detail drawer or expandable row
- Link to source document

Suggested filters:

```text
All
Overdue
This week
Needs action
Completed
```

UX direction:

- The most urgent task should be visually obvious.
- Completed tasks should not distract from open tasks.
- Every generated task should show why it exists.

Responsive layout:

- Desktop: list with side detail panel.
- Mobile: stacked list with expandable task details.

Taste Skill usage:

- Use for list density, hierarchy, and action button clarity.
- Avoid turning task rows into oversized cards.

### Page 11: Settings

Route:

```text
/settings
```

Purpose:

- Let users manage profile, password, and notification preferences.

Primary users:

- End users

Primary actions:

- Update profile
- Change notification preferences
- Change password
- Sign out

Content:

- Profile section
- Notification preferences
- Security section
- Account actions

UX direction:

- Keep settings grouped and predictable.
- Avoid exposing complex technical configuration.
- Use confirmation for destructive account actions.

Responsive layout:

- Desktop: sections in a single content column.
- Mobile: simple stacked sections.

Taste Skill usage:

- Minimal. Use for spacing and form clarity.

### Page 12: Admin Dashboard

Route:

```text
/admin
```

Purpose:

- Let platform operators monitor the system without exposing sensitive user document content.

Primary users:

- Platform operators
- Team members during demo

Primary actions:

- View processing status
- View failed extraction runs
- View non-sensitive usage statistics
- Manage user account status

Content:

- Processing overview
- Failed document processing list
- Non-sensitive usage metrics
- User account status table
- Admin action log

Important privacy rule:

- Admin users should not see private document content by default.
- Admin views should focus on system health and support, not user surveillance.

Suggested admin tabs:

```text
Overview
Processing
Users
Audit Log
```

UX direction:

- Admin page can be denser than end-user pages.
- Use tables carefully.
- Keep metrics operational and non-sensitive.

Responsive layout:

- Desktop: tabs with tables and summary metrics.
- Tablet: stacked tabs.
- Mobile: admin can be functional but does not need to be as polished as the main user flow.

Taste Skill usage:

- Use lightly.
- Do not make admin visually louder than user pages.
- Prioritize table clarity and privacy-safe information display.

## 8. Optional Future Pages

These pages should not be built in Phase 1 unless the team has time after the core MVP works.

### Email Connections

Route:

```text
/integrations/email
```

Purpose:

- Let users connect an email source with explicit permission.

Status:

- Future scope for Module 2.

### Voice / Conversation Records

Route:

```text
/conversations
```

Purpose:

- Show consent-based voice or transcript records.

Status:

- Future scope for Module 3.

### Organization Workspace

Route:

```text
/organization
```

Purpose:

- Let approved organization workers manage authorized client records.

Status:

- Future scope unless client prioritizes organization sales workflow.

## 9. Suggested Component Map

Shared layout components:

```text
AppShell
SidebarNav
MobileBottomNav
Topbar
PageHeader
StatusBadge
EmptyState
ConfirmDialog
```

Document components:

```text
DocumentUploadPanel
DocumentPreview
DocumentStatusBadge
DocumentList
DocumentSummary
ExtractionFieldEditor
ReviewStatusCallout
```

Task components:

```text
TaskList
TaskRow
TaskStatusBadge
TaskDetailPanel
DueDateIndicator
SourceDocumentLink
```

Admin components:

```text
AdminMetric
ProcessingFailureTable
UserStatusTable
AuditLogTable
```

## 10. Prompt Template for AI-Assisted UI Work

Use this prompt when asking an AI agent to build or redesign DayKeeper UI:

```text
Use Taste Skill as a UI quality checklist, but keep DayKeeper as a restrained operational dashboard, not a marketing website.

Project context:
DayKeeper is a responsive web app for vulnerable users. Users upload document photos, review AI-extracted obligations, and manage tasks and reminders.

Design priorities:
- clarity before decoration
- low cognitive load
- accessible contrast and readable text
- obvious next action
- mobile-first upload and review flow
- visible uncertainty for AI-extracted fields
- no decorative hero sections inside the app
- no generic feature-card layout
- no flashy gradients or visual clutter

Implement the requested page using the existing Next.js, Tailwind, shadcn/ui, and lucide-react stack.
```

## 11. Recommended Implementation Order

Recommended page implementation order:

1. App shell, sidebar, topbar, mobile bottom navigation
2. Login and register pages
3. Dashboard
4. Upload document photo page
5. Document archive page
6. Document detail page
7. Extraction review and confirmation page
8. Tasks and reminders page
9. Settings page
10. Admin dashboard
11. Optional public entry page polish

Reason:

- The app shell creates navigation consistency.
- Auth gates protect all later pages.
- Dashboard, upload, review, and tasks represent the core DayKeeper loop.
- Admin is required but should not drive the end-user experience.

## 12. Final UI Summary

DayKeeper should be designed around one product loop:

```text
Upload document photo
-> AI extracts possible obligations
-> User reviews uncertain fields
-> Confirmed information creates tasks and reminders
-> User manages obligations from dashboard
```

Every page should support this loop. Taste Skill should improve visual quality, but DayKeeper's safety, clarity, and accessibility requirements should remain the design authority.
