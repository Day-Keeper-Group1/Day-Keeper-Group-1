# PRDs

One PRD per vertical slice. Copy `_template.md` to `prd-<slice>.md` and fill it in.

| Slice | File | Status |
|---|---|---|
| A. Intake and extraction | `prd-intake.md` | not started |
| B. Confirm and archive | `prd-confirm-archive.md` | not started |
| C. Tasks and reminders | `prd-tasks-reminders.md` | not started |
| D. Accounts and operator console | `prd-accounts-admin.md` | not started |
| E. Platform and hosting | `prd-platform.md` | not started |

Rules:

- A PRD owns its slice's scope, data, endpoints and decisions. It cites the contract (`../design/contract.md`) and the user stories (`../design/user-stories.md`) rather than restating them.
- Ship as a pull request. Update the status column in the same PR.
- Anything cut from scope goes into the "Not in scope" table with a reason, so deferred work stays visible instead of silently disappearing.
