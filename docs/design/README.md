# Design docs

## What lives here

- `contract.md`: the JSON every processed document produces. The interface between intake and everything else.
- `schema.md`: consolidated database schema, merged from the Data sections of all slice PRDs.
- `user-stories.md`: personas, core loop stories, acceptance criteria per slice.
- `theme.md`: visual theme tokens.
- `pages/<area>/<page>/spec.md`: one spec per page. Copy `_template.md`.
- `flows/<name>-flow.md`: journeys that span several pages, with a full transition table.

## Page spec rules

- Areas: `user`, `auth`, `admin`.
- State vocabulary, use exactly these words: `loading`, `empty`, `loaded`, `error`.
- Screenshot naming: `baseline-{state}.png`, stored next to the spec.
- A page spec answers two questions: what must be on this screen, and which states are covered.

## Page index

Add a row when you add a spec.

| Area | Page | Spec | Status |
|---|---|---|---|
| user | upload | `pages/user/upload/spec.md` | not started |
| user | processing | `pages/user/processing/spec.md` | not started |
| user | pending | `pages/user/pending/spec.md` | not started |
| user | confirm | `pages/user/confirm/spec.md` | not started |
| user | archive | `pages/user/archive/spec.md` | not started |
| user | document-detail | `pages/user/document-detail/spec.md` | not started |
| user | tasks | `pages/user/tasks/spec.md` | not started |
| user | calendar | `pages/user/calendar/spec.md` | not started |
| auth | login | `pages/auth/login/spec.md` | not started |
| auth | register | `pages/auth/register/spec.md` | not started |
| admin | overview | `pages/admin/overview/spec.md` | not started |
| admin | accounts | `pages/admin/accounts/spec.md` | not started |
| admin | events | `pages/admin/events/spec.md` | not started |
