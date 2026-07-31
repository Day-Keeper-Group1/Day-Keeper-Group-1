# DayKeeper (G1)

AI-powered life management system for people in vulnerable groups: photograph or scan a document, the system reads it, and it becomes tasks and reminders. RMIT COSC2648 capstone project, P000473SE, Group 1.

## Repository layout

```
docs/
  prd/          One PRD per vertical slice (template inside)
  design/       Design docs: contract, schema, user stories, theme
    pages/      One spec per page (template in docs/design)
    flows/      Cross page journey docs
  prototype/
    user/       User side prototype (v0 lives here, iterate freely)
    admin/      Operator console prototype
  experiments/  Extraction experiment plans and results
fixtures/       Small curated synthetic fixtures (documents + ground truth)
```

## How we work

- Jira tracks status; this repo holds content; the group chat holds conversation.
- Design work ships as a pull request against `docs/`. Everyone reviews; review comments are contribution.
- Every ticket names its output document. First versions are starting points, not constraints: overturning them with reasons is good work.
- Nothing enters the calendar unconfirmed. Nothing enters `main` unreviewed.

## Team

Gerry Lu (Scrum Master) · Xiaocong "XC" Su · Hiruni Perera · Zhenying "Sai" Cui · Junchun "Jason" Zhang
Client: Prof. Mohammad Patwary · Supervisor: Dr. Golnoush Abaei
