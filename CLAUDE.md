# CLAUDE.md — DayKeeper G1

Working conventions for AI-assisted work in this repository. Human teammates: this file also documents our shared conventions, so it is worth a read.

## What this project is

DayKeeper reads a photographed or scanned document, extracts what it asks the user to do, and turns it into tasks and reminders after a single user confirmation. Phase 1 = Module 1 (document intake and extraction) + Module 4 (archive, tasks, reminders, admin). The user is easily overwhelmed; the product must never be.

## Constitution (do not violate)

- **Nothing enters the calendar unconfirmed.** Drafting happens before the confirm gate, commitment after it.
- **Fields the system cannot read reliably say so.** `uncertain` is a first-class state, surfaced to the user. Never guess.
- **One PostgreSQL.** Relational tables for structured entities, JSONB for variable-shape payloads. No second stateful store.
- **The system prepares, the user executes.** No sending, paying, or calling on the user's behalf.
- **Every task keeps its source document.** No task exists without provenance.
- **Test data is synthetic.** No real personal documents in this repository, ever. Fictional issuers only; no real logos, brands, or government insignia.

## Conventions

- Design documents live in `docs/`, ship as PRs, and get reviewed by the team.
- Commit messages in English, imperative mood.
- Branch names: `design/<topic>`, `feat/<topic>`, `fix/<topic>`.
- Reference decisions by document, not by memory: if it is not written down, it is not decided.
