# DayKeeper UI Image Generation Prompt Pack

Date: 6 August 2026  
Status: Prompt pack for visual exploration  
Audience: DayKeeper Group 1

## 1. Purpose

This document provides prompt templates for generating UI/UX concept images for DayKeeper.

Use these prompts to create multiple visual options, compare them, and select the strongest direction before implementation. The goal is not to generate final production UI directly. The goal is to discover good layout, hierarchy, tone, and interaction patterns.

## 2. Current Visual Direction Feedback

The current generated style is clean and restrained, which is a good starting point. However, it has these issues for DayKeeper:

- Too much empty space.
- Feels more like a public landing page than the actual product.
- Does not show enough of the core DayKeeper workflow.
- Does not show dashboard navigation.
- Does not show document review, task urgency, or AI uncertainty.
- The UI lacks a complete product system.
- Some concepts use too much explanatory text, too many feature cards, and too many annotation labels.
- Some bill visuals look too clean, flat, or digitally perfect. DayKeeper should show realistic paperwork: slightly crumpled, creased, imperfect, and based on real-world bills or letters.
- The "clear reveal" area should not use a hard circular lens, obvious border, or sharp outline. It should feel like a soft focus reveal with feathered, organic edges.

The next image generations should focus on real application screens:

- dashboard
- document photo upload
- extraction review and confirmation
- tasks and reminders
- document archive
- admin dashboard
- responsive mobile layout

## 3. Global Prompt Rules

Use this instruction at the beginning of most prompts:

```text
Design a high-fidelity UI mockup for DayKeeper, a responsive web app for vulnerable users. DayKeeper helps users upload photos of letters or bills, review AI-extracted obligations, and manage tasks and reminders. The UI should be calm, trustworthy, accessible, and low cognitive load. Use Taste Skill-inspired visual quality: strong spacing, real product hierarchy, no generic AI-dashboard look, no decorative hero clutter. This is an operational product dashboard, not a marketing landing page.
```

Use this negative direction:

```text
Avoid flashy gradients, purple AI aesthetics, decorative blobs, glassmorphism, fake 3D illustrations, oversized hero sections inside the app, generic feature cards, unreadable tiny text, crowded tables, text overlapping UI elements, too many annotation callouts, dotted connector lines, hard magnifying-glass circles, sharp reveal boundaries, and fake-perfect digital bills.
```

Use this accessibility direction:

```text
Use readable text, large tap targets, clear status badges, strong contrast, obvious primary actions, and responsive layouts for desktop and mobile.
```

Use this visual restraint direction for landing/hero images:

```text
Keep visible text minimal. Use one strong headline, one short supporting sentence, and one primary action. Avoid explanatory paragraphs, bottom feature-card rows, and more than three small UI labels. The image should communicate the idea through the blurred-to-clear document interaction, not through excessive text.
```

## 3A. Refined Hero Concept: Blurred Crumpled Bill Reveal

Use this when generating the public entry or demo hero.

```text
Create a high-fidelity hero section for DayKeeper, a calm responsive web app that turns confusing paperwork into clear next steps.

Core visual metaphor:
A realistic, slightly crumpled electricity bill or government letter lies on a soft off-white desk surface. Most of the bill is blurred, faded, and difficult to read. Around the cursor or focus point, the bill becomes clear naturally, as if the user's attention reveals it. The clear area must have soft feathered edges, like a gentle focus gradient, with no hard circle, no lens border, and no obvious outline.

UI composition:
- very minimal top navigation: DayKeeper logo, Sign in, Create account
- one headline only: "Paperwork, made clear."
- one short supporting line: "Upload a photo. DayKeeper finds what matters."
- one primary button: "Upload document photo"
- optional tiny extracted chips near the clear area, maximum three: "Due 15 Aug", "$125.40", "Pay bill"

Visual style:
- premium restrained product design
- calm, trustworthy, accessible
- realistic crumpled paper texture, visible creases and slight shadows
- soft daylight, subtle depth, tactile realism
- warm off-white background
- restrained blue/teal primary colour
- amber used only for one "check" state if needed
- lots of breathing room, but not empty or unfinished

Avoid:
- too much text
- bottom feature cards
- dotted connector lines
- hard magnifying glass circle
- sharp mask boundary
- fake futuristic AI interface
- perfect flat digital invoice
- glossy marketing SaaS clutter
- purple gradients
- decorative blobs
```

Short version:

```text
DayKeeper premium minimal hero UI, realistic crumpled bill on soft off-white desk, most text blurred, cursor reveals a naturally clear area with soft feathered edges, no hard circle or border, minimal copy "Paperwork, made clear.", one CTA "Upload document photo", only three tiny extracted chips: Due 15 Aug, $125.40, Pay bill, calm trustworthy accessible product design, restrained blue/teal, tactile paper realism, no feature cards, no dotted lines, no flashy AI style.
```

## 4. Prompt 1: Full Product Dashboard

Use this when you want the main logged-in experience.

```text
Design a high-fidelity desktop UI mockup for DayKeeper, a responsive web app for vulnerable users who need help managing letters, bills, appointments, and obligations.

Screen: logged-in user dashboard.

Layout:
- left sidebar navigation with Dashboard, Upload, Archive, Tasks, Settings
- top bar with page title, search, notifications, and user menu
- main dashboard content

Content:
- a calm status summary: "3 documents need review", "2 tasks due this week", "1 overdue"
- a prominent "Upload document photo" action
- a "Needs review" section showing AI-extracted documents with uncertain fields
- an "Upcoming tasks" section with due dates and source document links
- an "Overdue" section with soft red warning styling
- a compact "Recent documents" list

Visual style:
- calm, trustworthy, polished SaaS dashboard
- soft off-white background, subtle borders, restrained blue/teal primary colour
- amber for needs review, soft red for overdue, green for completed
- clean typography, generous spacing, no visual clutter
- professional but warm, suitable for users with cognitive overload

Important:
- make the next action obvious
- do not make it look like a marketing landing page
- do not use decorative gradients or generic AI feature cards
- show realistic UI hierarchy and responsive product logic
```

## 5. Prompt 2: Mobile Dashboard

Use this to explore phone-first experience.

```text
Design a high-fidelity mobile UI mockup for DayKeeper on a modern smartphone.

Screen: logged-in mobile dashboard.

Product context:
DayKeeper helps vulnerable users upload photos of letters and bills, review AI-extracted information, and manage tasks and reminders.

Layout:
- top header with DayKeeper name and notification icon
- bottom navigation with Home, Upload, Archive, Tasks, More
- Upload should be the most prominent navigation action
- single-column content ordered by urgency

Content order:
1. primary button: "Upload document photo"
2. "Needs review" section with uncertain extracted fields
3. "Overdue" task section
4. "Due this week" section
5. "Recent documents" section

Visual style:
- calm, accessible, trustworthy
- large tap targets
- readable typography
- soft neutral background
- restrained blue/teal primary action
- amber review badges, soft red overdue badges, green completed badges

Avoid:
- dense data tables
- marketing hero layout
- tiny text
- decorative blobs or flashy gradients
- too many cards competing for attention
```

## 6. Prompt 3: Document Photo Upload Flow

Use this for the document input page.

```text
Design a high-fidelity UI mockup for DayKeeper's document photo upload page.

Screen: upload document photo.

Goal:
The user should easily upload or take a photo of a letter, bill, or form. The flow should feel simple and reassuring.

Layout:
- app shell with sidebar navigation on desktop
- main page title: "Upload document photo"
- large upload zone with icon and clear instruction
- mobile-friendly camera action
- preview panel showing the selected document image
- file details: type, size, upload readiness
- primary button: "Process document"
- secondary action: "Replace photo"

UX requirements:
- use "photo upload", not "scan"
- explain supported formats briefly
- show validation errors in plain language
- avoid technical OCR/AI language
- make retake/replace easy

Visual style:
- calm, polished, minimal but not empty
- soft neutral background
- clear border around upload area
- accessible contrast
- generous spacing
- suitable for older or stressed users

Avoid:
- futuristic AI visuals
- complex settings
- decorative hero layout
- large empty whitespace with no guidance
```

## 7. Prompt 4: Extraction Review and Confirmation

Use this for the most important DayKeeper screen.

```text
Design a high-fidelity desktop UI mockup for DayKeeper's AI extraction review page.

Screen: document review and confirmation.

Product context:
DayKeeper reads a user's uploaded document, extracts possible obligations, and asks the user to confirm or correct the information before creating tasks and reminders.

Layout:
- desktop split view
- left side: original document preview with zoom controls
- right side: editable extracted information form
- sticky bottom or right-side primary action: "Confirm and create task"

Extracted fields:
- document type
- sender / issuer
- action required
- due date
- amount
- reference number
- summary

Status states:
- confirmed: green check badge
- uncertain: amber "Please check" badge
- unreadable: soft red "Needs input" badge

UX requirements:
- the user must feel in control
- AI uncertainty must be visible
- do not present AI output as final until confirmed
- each field should show extracted value, raw text evidence, and an edit action
- use supportive language such as "Please check this date"

Visual style:
- refined operational dashboard
- clear information hierarchy
- warm but professional
- no visual clutter
- no flashy AI styling

Avoid:
- hiding uncertainty
- tiny form text
- decorative illustrations
- generic three-card dashboard layout
```

## 8. Prompt 5: Mobile Extraction Review

Use this to test if the core workflow works on phone.

```text
Design a high-fidelity mobile UI mockup for DayKeeper's extraction review flow.

Screen: mobile document review.

Goal:
The user reviews AI-extracted fields from a document photo and confirms or corrects them before a task is created.

Layout:
- top app bar with back button and page title
- compact document summary at top
- collapsible original document preview
- field-by-field review cards
- each field has status, value, raw text evidence, and edit control
- sticky bottom button: "Confirm and create task"

Field states:
- confirmed in green
- uncertain in amber with "Please check"
- unreadable in soft red with "Enter value"

UX requirements:
- mobile-first
- large tap targets
- clear labels
- minimal cognitive load
- obvious next action
- no dense table layout

Visual style:
- calm, trustworthy, accessible
- soft neutral surfaces
- subtle borders
- restrained blue/teal primary colour
- polished but simple
```

## 9. Prompt 6: Tasks and Reminders

Use this for the core task management page.

```text
Design a high-fidelity UI mockup for DayKeeper's tasks and reminders page.

Screen: tasks and reminders.

Product context:
Confirmed obligations from uploaded documents become tasks and reminders. The user needs to see what is overdue, what is due soon, and what has been completed.

Layout:
- app shell with sidebar navigation
- page title: "Tasks"
- filter tabs: All, Overdue, This week, Needs action, Completed
- list of tasks grouped by urgency
- task detail side panel showing source document, due date, reminder time, and action history

Task row content:
- task title
- due date
- status badge
- source document link
- complete button
- edit action

Visual style:
- calm productivity dashboard
- restrained colour system
- soft red for overdue
- amber for needs action
- green for completed
- strong but not aggressive priority hierarchy

UX requirements:
- most urgent task is visually obvious
- completed tasks do not distract from open tasks
- every task links back to its source document
- avoid overwhelming the user with too many controls
```

## 10. Prompt 7: Document Archive

Use this for document browsing and retrieval.

```text
Design a high-fidelity UI mockup for DayKeeper's document archive page.

Screen: document archive.

Goal:
The user can browse, search, filter, and reopen saved documents and their extracted information.

Layout:
- sidebar navigation
- top search bar
- filter controls for status and document type
- document list with issuer, document type, due date, processing status, and last updated date
- clear empty state for first-time users

Statuses:
- processing
- needs review
- confirmed
- failed

Visual style:
- clean information management interface
- polished but restrained
- soft off-white background
- subtle dividers
- readable rows
- status badges with clear colours

UX requirements:
- easy to find documents
- needs review and failed states must stand out
- avoid dense spreadsheet feeling
- mobile should convert rows into stacked list items
```

## 11. Prompt 8: Admin Dashboard

Use this for platform operator/admin exploration.

```text
Design a high-fidelity UI mockup for DayKeeper's platform admin dashboard.

Screen: admin dashboard for platform operators.

Important privacy rule:
Admin users should monitor system health and account status without seeing private document content by default.

Layout:
- admin sidebar or admin tab inside app shell
- top summary metrics
- tabs: Overview, Processing, Users, Audit Log
- processing failures table
- non-sensitive usage metrics
- user account status table
- admin action log

Content:
- total documents processed
- extraction success rate
- failed processing runs
- active users
- pending review count
- recent system errors

Visual style:
- operational and professional
- slightly denser than end-user screens
- clear table alignment
- restrained colour system
- no decorative visuals

UX requirements:
- privacy-safe by design
- system health is easy to scan
- failed processing items are easy to investigate
- admin actions are clearly logged
```

## 12. Prompt 9: Complete Responsive Design Board

Use this to generate a full design direction board.

```text
Create a high-fidelity UI/UX design board for DayKeeper, showing both desktop and mobile screens.

Product:
DayKeeper is a responsive web app for vulnerable users. Users upload document photos, review AI-extracted obligations, and manage tasks and reminders.

Show these screens together:
- desktop dashboard
- mobile dashboard
- desktop document review split view
- mobile upload flow
- tasks page
- small component samples: status badges, task row, document row, primary button, warning callout

Visual direction:
- calm, trustworthy, accessible
- refined operational dashboard
- soft neutral background
- restrained blue/teal primary colour
- amber for needs review
- soft red for overdue or unreadable
- green for confirmed/completed
- clear typography
- generous spacing
- no visual clutter

Taste Skill-inspired quality:
- avoid generic AI UI
- avoid fake feature cards
- avoid decorative blobs
- avoid flashy gradients
- avoid landing-page composition inside the product
- make every component look usable and purposeful

The result should look like a real product design system ready to be implemented in Next.js, Tailwind CSS, shadcn/ui, and lucide-react.
```

## 13. Prompt 10: Warm Paper-Inspired Direction

Use this if the current black-and-white style feels too cold.

```text
Design a high-fidelity UI concept for DayKeeper using a warm paper-inspired visual direction.

Product context:
DayKeeper helps vulnerable users turn letters and bills into confirmed tasks and reminders.

Visual style:
- warm off-white background
- subtle paper-like surfaces without heavy texture
- deep ink text
- restrained blue/teal primary actions
- amber review states
- soft red overdue states
- green confirmed states
- modern clean typography
- soft but crisp borders

Screen:
logged-in dashboard with upload action, needs review documents, upcoming tasks, overdue tasks, and recent documents.

UX requirements:
- low cognitive load
- no decorative clutter
- no nostalgic scrapbook look
- no fake handwritten style
- must still feel like a serious secure web app
```

## 14. Prompt 11: Clinical Trust Direction

Use this if the team wants the product to feel more healthcare/support-service appropriate.

```text
Design a high-fidelity UI concept for DayKeeper with a clinical trust visual direction.

Product context:
DayKeeper is a responsive web app for vulnerable users and possible support organizations. It manages document-derived obligations, reminders, and review workflows.

Screen:
document extraction review and confirmation page.

Visual style:
- clean healthcare-adjacent interface
- calm white and very light grey surfaces
- muted teal and blue accents
- amber for review warnings
- soft red for unreadable or overdue states
- excellent spacing
- clear forms
- accessible labels
- professional but not cold

UX requirements:
- user remains in control
- uncertain AI fields are clearly highlighted
- original document preview is visible
- confirm action is obvious
- no decorative hero imagery
- no generic AI chatbot elements
```

## 15. Prompt 12: Modern Civic Service Direction

Use this if the team wants DayKeeper to feel like a trustworthy public-service tool.

```text
Design a high-fidelity UI concept for DayKeeper with a modern civic service visual direction.

Product:
A responsive web app that helps users manage letters, bills, forms, deadlines, and reminders.

Screen:
main user dashboard.

Visual style:
- trustworthy public-service quality
- clear navigation
- soft neutral background
- strong readable typography
- restrained blue primary colour
- amber and red only for attention states
- minimal decorative elements
- practical and polished

Content:
- upload document photo action
- needs review section
- overdue tasks
- upcoming tasks
- recent documents
- notification preview

UX requirements:
- simple enough for stressed users
- visually organized for repeated use
- no marketing hero layout
- no glossy AI aesthetic
- no excessive whitespace
```

## 16. Fast Batch Prompts for Visual Exploration

Use these short prompts when generating many options quickly.

### Batch A

```text
DayKeeper responsive web app dashboard, calm accessible SaaS UI for vulnerable users, document photo upload, needs review, overdue tasks, upcoming reminders, soft neutral background, teal primary colour, amber warning badges, polished operational dashboard, no marketing hero, no decorative gradients.
```

### Batch B

```text
DayKeeper document extraction review UI, desktop split view with original letter preview and editable AI-extracted fields, confirmed uncertain unreadable status badges, user confirmation before task creation, calm trustworthy accessible interface, refined dashboard style.
```

### Batch C

```text
DayKeeper mobile upload flow, camera-first document photo upload, preview selected letter, process document button, low cognitive load, large tap targets, soft neutral interface, accessible status feedback, polished mobile product UI.
```

### Batch D

```text
DayKeeper tasks and reminders page, overdue and upcoming obligations from uploaded documents, source document links, task completion actions, calm productivity dashboard, readable rows, soft red amber green statuses, no generic AI style.
```

### Batch E

```text
DayKeeper admin dashboard, privacy-safe platform operator view, processing status, extraction failures, non-sensitive usage metrics, user account statuses, clean professional operational UI, clear tables, restrained colours.
```

### Batch F: Minimal Crumpled Bill Hero

```text
DayKeeper minimal premium hero UI, realistic wrinkled crumpled bill photo, most of the bill softly blurred, cursor reveals one clear area with organic feathered edges, no hard circular lens, no border, no dotted lines, minimal headline only, one CTA, calm trustworthy accessible design, warm off-white background, restrained teal accent, tactile paper realism.
```

### Batch G: Editorial Paper Clarity

```text
DayKeeper editorial product hero, one crumpled real-world bill on desk, blurred unreadable paperwork gradually becoming clear near cursor focus, soft natural reveal edge like depth-of-field, sparse typography, "Paperwork, made clear.", one upload button, no feature cards, no annotation clutter, elegant accessible civic-service aesthetic.
```

### Batch H: Ultra Minimal Interaction Concept

```text
DayKeeper interaction concept UI, almost no text, realistic creased utility bill blurred across the page, small cursor hover area reveals due date and amount clearly with feathered blur falloff, subtle floating chips Due 15 Aug and Pay bill only, premium calm interface, no magnifier circle, no explicit boundary, no marketing clutter.
```

## 17. Selection Checklist

When choosing generated UI images, score each option from 1 to 5:

| Criterion | Question |
|---|---|
| Clarity | Can a user understand what to do next within 5 seconds? |
| Product fit | Does it look like DayKeeper, not a generic AI landing page? |
| Accessibility | Are text, contrast, spacing, and tap targets comfortable? |
| Workflow support | Does it show upload, review, tasks, or reminders clearly? |
| Trust | Would a user trust this with sensitive letters or bills? |
| Implementation realism | Can the team build this with Next.js, Tailwind, shadcn/ui, and lucide-react? |
| Mobile readiness | Would the same idea work on a phone? |
| Uncertainty visibility | Are uncertain or unreadable AI fields clearly visible? |

Reject designs that:

- look impressive but do not show the actual workflow
- hide AI uncertainty
- look like a startup landing page only
- require complex animation or 3D effects
- depend on tiny text or dense tables
- use decorative visuals instead of useful interface structure

## 18. Recommended Image Generation Strategy

Generate images in this order:

1. 6 variations of the desktop dashboard.
2. 6 variations of the extraction review page.
3. 4 variations of the mobile upload flow.
4. 4 variations of the tasks page.
5. 2 variations of the admin dashboard.
6. 2 full design boards combining desktop and mobile.

Then choose:

- one best dashboard direction
- one best review-page direction
- one best mobile direction
- one best colour and component system

Do not choose based only on the prettiest image. Choose based on whether the design supports DayKeeper's real product loop:

```text
Upload document photo
-> AI extracts possible obligations
-> User reviews uncertainty
-> Confirmed information creates tasks and reminders
-> User manages obligations
```
