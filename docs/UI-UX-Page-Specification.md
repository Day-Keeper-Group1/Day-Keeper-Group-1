# DayKeeper UI/UX Page Specification

Date: 6 August 2026  
Status: Draft for UI planning before feature implementation  
Audience: DayKeeper Group 1

Revision: aligned to ADRs 001-008 on 18 August 2026. Where this document and an ADR disagree, the ADR wins.

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

The interface should make the next action obvious. Users should not need to understand the technology behind the reading, the model, or task generation.

## 3. Design Principles

Use these principles across every page:

- Clarity before decoration.
- One primary action per screen.
- Short, plain-language labels.
- Clear distinction between `needs review`, `confirmed`, `overdue`, and `completed`, always carried by a word and not by colour alone (ADR 007, `docs/theme.md`).
- Every AI-generated task links back to its source document.
- The product shows, it never asks (ADR 008). A value the model was not sure of never reaches a screen, so there is no uncertainty to display and nothing to interrogate the user about.
- The product has two verbs, photograph and tick. Nothing on a screen is an editable copy of what was read.
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

The palette is **Eucalypt & Wattle**, and `docs/theme.md` is the authority: it carries the tokens, the measured contrast of every pair, and the reasons. Two of its rules override anything suggested here. **Nothing is blue**, because an ageing eye needs about 2400ms longer to tell blue from yellow. **Colour is never the only signal**, so every state below also carries a word.

Colour roles, as the theme names them:

| Role | Token | Use |
|---|---|---|
| Eucalypt green | `--primary` | Main actions, active navigation, trusted system state |
| Bark brown on sand | `--warn-ink` on `--warn-bg` | "The letter did not give this up", the card sentence when a date or an action is missing |
| Deep red | `--danger`, `--dot-due` | A reading that failed, destructive actions, and the calendar's due marks. **Not the overdue state on a task row**: that is told in words (ADR 007) |
| Green | `--success` | Confirmed fields, completed tasks |
| Warm paper and neutral | `--bg`, `--bg-card`, `--line` | Background, dividers, secondary metadata. Never pure white |

Gold (`--focus-ink`, `--dot-rem`) is never text. It appears in exactly two places, the lining of the focus ring and the reminder dot on the calendar.

Typography:

- Use clear sans-serif typography.
- Use compact dashboard headings, not oversized hero typography.
- Body text is at least 18px and a primary button at least 48px tall, on every device. The prototype's own type is still the older smaller scale; build to the sizes in `docs/theme.md` rather than matching the sketch.
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
| Upload | `/documents/new` | Photograph a pile of letters and post it |
| Archive | `/documents` | Search and browse saved documents |
| Tasks | `/tasks` | Manage open and completed obligations |
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

Mobile `Upload` should be visually prominent because photographing a letter is the primary entry point, and it is also the only remedy the product offers when a reading is wrong or missing.

## 6. Recommended Page Count

MVP route count: **11 pages/routes**

| Group | Count | Pages |
|---|---:|---|
| Public/Auth | 4 | `/`, `/login`, `/register`, `/forgot-password` |
| User App | 6 | `/dashboard`, `/documents/new`, `/documents`, `/documents/[id]`, `/documents/[id]/review`, `/tasks` |
| Settings/Admin | 2 | `/settings`, `/admin` |

Total: **12 route entries** if `/forgot-password` is included. Password reset is deferred, so the MVP is **11 routes**.

Recommendation:

- Build the six user app pages first. The signed-in surface is where the product is, and it can be built ahead of sign-in: the seed plants accounts and a development session, and every handler asks `requireUser()` (ADR 002), so a page written today works unchanged the day sign-in lands.
- `/login` and `/register` are deprioritised rather than skipped. The endpoints are specified; the screens are not on the critical path.
- Keep `/forgot-password` as a placeholder route. Password reset needs an email sender and no service has been chosen, so the page exists and does nothing, which is honest about the state of it.

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

Status: deprioritised. Until it is built, the seeded accounts and the development session in the seed are how anyone reaches the signed-in pages.

Purpose:

- Let returning users securely access their account, against our own `users` and `sessions` tables (ADR 002), not a hosted auth provider.

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

Status: deprioritised, same as Login.

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

Status: not implemented. It needs an email sender, which nobody has chosen; `docs/api.md` keeps it on the open list. The route exists as a placeholder.

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

- Give users a daily overview of letters waiting to be checked and of everything still to do.

Primary users:

- End users

Primary actions:

- Photograph a letter
- Check a letter that is ready
- Tick a task off

Content, and it all arrives in one request (`GET /api/home`) so the counts and the lists cannot disagree on screen:

- Call to action panel, driven by `counts` in order: "N things need your OK", otherwise "Reading your letters…", otherwise "Nothing to check right now"
- Primary photograph action
- To check: batches still being divided, then every document in `processing`, `needs-review` or `failed`, drawn as one interleaved list
- Coming up: **one** task list, every open task whatever its date plus anything completed in the last seven days, due date ascending with dateless tasks last, capped at 20

Suggested layout:

```text
Header summary
Primary photograph action
To check panel (dividing batches, then inbox)
Coming up panel (one task list)
```

UX direction:

- The user should immediately understand what needs attention today.
- Do not show too many metrics.
- Use plain labels such as "Needs review" instead of technical words like "low confidence".
- **There is no separate overdue panel and no overdue badge** (ADR 007). Overdue is derived while drawing, told in words in the date column ("was due Wed 5 Aug") and set bolder, and the ascending sort already puts it at the top because an overdue date is smaller than every upcoming one.
- A task with no due date shows "No date" where the date goes, and stays on the list until it is ticked.
- Open tasks are never filtered by date. An unpaid bill from three weeks ago is the loudest thing the person owns, and a "due today or later" rule would quietly remove exactly that row.

Responsive layout:

- Desktop: two-column dashboard with the to check panel on the left and the task list on the right.
- Tablet: stacked two-column groups.
- Mobile: single-column feed ordered by urgency:
  1. Photograph
  2. To check
  3. Coming up

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

- Let users post a pile of photographs, however many letters it turns out to hold.

Primary users:

- End users

Primary actions:

- Take photos, or choose them from the album
- Review the pile before posting
- Post the pile

Content:

- Upload dropzone or file picker, accepting several files at once
- Mobile camera-compatible file input
- Supported format note
- Limits note: up to 10 photographs, up to 10 MB each, imported from `src/lib/contract/api.ts` rather than retyped
- Thumbnails of the pile so far, with remove
- Post button
- "Posted just now" card, which is the same two lists the dashboard's to check panel draws

UX direction:

- Use "photo upload" wording, never "scan".
- **An upload is a pile, and one pile may become any number of letters** (ADR 005). The pages of one letter can arrive shuffled between another's, and a photograph that is no letter at all is fine. Nothing on this screen asks the person to say which photograph belongs to which letter; that sorting is the job the product exists to do.
- The person is never told that photographs one and three became one letter. She is told there is an electricity bill for $347.60 due on the fifteenth, and asked whether that is right, on the review screen.
- A retake is not a special channel. Photographing a letter again is an ordinary new pile through this same screen, and the matching step recognises it.
- Keep instructions short.
- Make file validation errors clear and non-technical.
- Do not expose model or extraction terminology unless needed.

Still open, so do not design past them (`docs/api.md`, "Deliberately not specified"): how the camera is actually held open between shots, what the screen does when the person reaches ten photographs or a photograph is over 10 MB, whether a blur check can happen at capture time, and how one posted row becomes several letters on screen.

Responsive layout:

- Desktop: upload area beside the thumbnails and instructions.
- Mobile: camera-first flow, thumbnails of the pile below the file input.

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

- Make "needs review" and "failed" easy to notice, by wording as well as by colour.
- Search and filters should not dominate the screen.
- Show useful metadata: issuer, document type, due date, last updated.
- Putting a letter away destroys nothing: it keeps its task, its reminders and its calendar dots, because a person confirmed it and that has not stopped being true. Where a person browses letters they have put away is not settled; this route is the proposal, not a decision.

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
- Do not show raw AI output as the main content. There is no transcription snippet to show at all: the contract carries no `raw_text` (ADR 004).
- Nothing here is editable either. The fields are what the last successful reading said, shown, and the only way to change them is photographing the letter again.

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

- Let users see what was read and accept it, before tasks and reminders are created.

Primary users:

- End users

Primary actions:

- Confirm
- Photograph the letter again, when something is wrong or missing
- Open the photograph

Content:

- Original document preview
- Extracted fields, read-only, in reading order
- Card-level sentence when the date or the action is missing
- Plan card saying what DayKeeper will do, worded by `planReminders()` and never by hand: a deadline gets reminders 7, 3 and 1 days before at 9 am local, an appointment (anything with a time on it) gets one the day before, and a reminder whose day has already gone is never shown and never created
- Confirm button
- Back action

Field statuses that reach this screen:

```text
confirmed
unreadable
```

`uncertain` is a third state in storage only. How often the model hedges, and what it guesses when it does, is evaluation data; the server collapses it to `unreadable` on the way out, so no screen, no API response and no projection ever carries a value the model was not sure of (ADR 008).

UX direction:

- This is one of the most important pages in DayKeeper.
- **The screen shows, it never asks** (ADR 008). Nothing is editable: no text inputs, no date box, no dropdowns, no "please check this" prompt, no acknowledgement toggle. Confirming is an empty `POST`, and its only error is that the letter was already confirmed.
- **Rows without a confident value are not drawn.** An empty row invites an answer nobody is being asked for. When the date or the action is missing, the card says so once, in a plain sentence with a full stop: "This letter doesn't give a clear date. It's saved; nothing goes on your calendar."
- That sentence is set in bark brown on sandy yellow, not orange and not red. This reader tends to blame herself, and an alarm colour reads as *I did something wrong* when what it means is *the letter did not give this up*.
- **The one remedy is the camera.** Whatever is wrong or missing, whether the photograph was poor or the letter itself never said, the person's one move is photographing the letter again, through the same capture screen as everything else. The matching step recognising the new photographs as this letter is what corrects the record.
- The user's job is recognition, not data entry: does this match the letter? Recognition is easy for this audience; typing a date into a box on a phone is not.
- The promise the screen makes is checkable: **you will be asked whenever what you have to do changes, and never otherwise.** Pages that arrive later for a letter already confirmed are compared on four values (`action_required`, `due_date`, `due_time`, `amount`); if any changed the letter comes back here, and if none did it is updated silently.
- A letter with a clear action and no clear date is still confirmed into a task. It shows "No date", never reminds, never touches the calendar, and stays on the list until it is ticked. A letter with no clear action becomes no task at all; it is kept as a letter.
- An unreadable field never blocks confirming. Trapping the person on a screen that offers her nothing to fix is a worse failure than a missing reference number.

Responsive layout:

- Desktop: split view:
  - left: original document preview
  - right: the read-only field list and the confirm button
- Mobile:
  - top: short document summary
  - then: the field list, read top to bottom
  - document preview accessible through expand/collapse

Taste Skill usage:

- Use strongly here, but with strict constraints.
- Prioritize clarity, large legible values, and one obvious button.
- Do not add decorative visuals that distract from recognition.

### Page 10: Tasks and Reminders

Route:

```text
/tasks
```

Purpose:

- Let users manage the obligations that came out of their letters. There is no manual task creation: a task exists because a confirmed letter said so.

Primary users:

- End users

Primary actions:

- Tick a task off
- Untick it again
- Open the source document

Content:

- One task list, due date ascending, dateless tasks last
- Optional filters as views over that one list
- Task detail drawer or expandable row, showing the letter's fields and its reminders
- Link to source document

Suggested filters:

```text
All
Open
Completed
```

UX direction:

- **The tick is the only state a task stores** (ADR 007). Completed, overdue and upcoming are worked out while drawing, from the tick and today's date in the person's timezone. Nothing writes "overdue" anywhere, so nothing has to notice midnight.
- **Overdue is told in words, not colour**: `was due Wed 5 Aug` in the date column, set bolder. Not red, because red already means a failed reading here. No badge and no separate overdue section: due date ascending puts an overdue row above every upcoming one, so the pinning is the sort.
- A task with no due date reads "No date", draws no calendar mark, has no reminders, and stays on the list until it is ticked. The list itself is its reminder.
- **Ticking is never locked**, in either direction, forever, wherever the row is visible: this list, the dashboard, and the calendar's day sheet. Unticking a task whose date has passed makes it overdue by arithmetic, not by transition, and nobody should need an apology for ticking something off by accident three weeks ago.
- The calendar is a view of this same data and has none of its own: due dates as red dots, reminders as gold ones, and a day sheet that words each reminder from the task and the day. Nothing on it is editable and there is no manual calendar entry. This specification has no route for it yet; the prototype does.
- Ticking writes nothing to reminders and unticking writes nothing back. A reminder's own moment is when the product decides: still open means it is sent, already done means it is skipped silently. So "no more reminders for this" is derived truth on screen, never a stored flag.
- Reminder statuses a row may show are `scheduled`, `sent`, `skipped` and `failed`. There is no cancelled.
- Completed tasks should not distract from open tasks.
- Every generated task should show why it exists, by linking to the letter it came from.
- The only thing this screen can change about a task is the tick. Editing a title, a date or an amount is not a missing feature; the remedy for a wrong reading is photographing the letter again.

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

Status: not specified yet. Profile, notifications, password change, delete account and exposing the timezone the schema already stores are all on the open list in `docs/api.md`. The route is planned; the endpoints behind it are not designed.

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

- Admin users should not see private document content. This is structural, not a setting: the operator role grants no access to letter content and the audit table has nowhere to put it (ADR 002).
- Admin views should focus on system health and support, not user surveillance.
- The operator's exact permissions are still open, and the endpoints behind this page wait on them.

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
PilePanel
DocumentPreview
DocumentStatusBadge
DocumentList
DocumentSummary
ExtractionFieldList
MissingValueNote
```

`PilePanel` takes several photographs and posts them as one batch. `ExtractionFieldList` is read-only and draws no row for a value that is absent; `MissingValueNote` is the card-level sentence that says what the letter did not give up. There is no field editor and no correction component anywhere in this map.

Task components:

```text
TaskList
TaskRow
TaskTick
TaskDetailPanel
DueDateIndicator
SourceDocumentLink
```

`DueDateIndicator` carries the whole overdue signal, in words: an ordinary date, `was due Wed 5 Aug` in bold, or `No date`. There is no overdue badge to build.

Admin components:

```text
AdminMetric
ProcessingFailureTable
UserStatusTable
AuditLogTable
```

## 10. Prompt Template for UI Work

Use this prompt when asking an agent to build or redesign DayKeeper UI:

```text
Use Taste Skill as a UI quality checklist, but keep DayKeeper as a restrained operational dashboard, not a marketing website.

Project context:
DayKeeper is a responsive web app for vulnerable users. Users photograph a pile of letters, look at what was read, and manage the tasks and reminders that follow. The product has two verbs, photograph and tick.

Design priorities:
- clarity before decoration
- low cognitive load
- accessible contrast and readable text: body 18px or larger, primary buttons 48px or taller
- obvious next action
- mobile-first capture and review flow
- read-only review: no field editing, no date box, no "please check this" prompt
- a state is never carried by colour alone, and nothing is blue
- no decorative hero sections inside the app
- no generic feature-card layout
- no flashy gradients or visual clutter

Read docs/theme.md before styling anything, and use the palette tokens rather than typing a hex value.

Implement the requested page using the existing Next.js, Tailwind, shadcn/ui, and lucide-react stack.
```

## 11. Recommended Implementation Order

Recommended page implementation order:

1. App shell, sidebar, topbar, mobile bottom navigation
2. Dashboard
3. Upload document photo page
4. Extraction review and confirmation page
5. Tasks and reminders page
6. Document archive page
7. Document detail page
8. Login and register pages
9. Admin dashboard
10. Settings page
11. Optional public entry page polish

Reason:

- The app shell creates navigation consistency.
- Dashboard, upload, review, and tasks are the core DayKeeper loop, and they are built first because the loop is the product.
- Sign-in does not gate that work. Every handler asks `requireUser()` and the seed plants an account and a session, so the pages are written against a real signed-in user from day one and the login screen slots in behind them later.
- Admin is required but should not drive the end-user experience, and settings is not designed yet.

## 12. Final UI Summary

DayKeeper should be designed around one product loop:

```text
Photograph a pile of letters
-> The reading says what letters are in it and what each one says
-> User looks at what was read and nods
-> Confirmed information creates tasks and reminders
-> User ticks obligations off from the dashboard, the task list or the calendar
```

Every page should support this loop. Taste Skill should improve visual quality, but DayKeeper's safety, clarity, and accessibility requirements should remain the design authority, and where this document and an ADR disagree, the ADR wins.
