# Email integration — Module 2

This is incoming email intelligence from the project baseline, not outgoing
reminder delivery. The photo-upload release remains defined in `scope.md`.

## Implemented foundation

`src/server/email/provider.ts` defines a mailbox adapter bound to one authorised
connection, validated email pages, and an email extraction interface.
`read.ts` validates adapter output and extraction output. Actionable email uses
the existing `ExtractionResult`; a separate `no-action` result represents mail
without a task. `mock-provider.ts` provides repeatable pages supplied by tests.
The mock foundation needs no credentials, network access or database.
Run `npm run -s test -- tests/email.test.ts`.

The `/email-demo` page now uses the mock mailbox and validation boundary to show
three fictional messages: a bill, an appointment and a newsletter. Open a message
to see its sender, received time, body and predefined extraction result. The
newsletter demonstrates `no-action`. The page is public so a demonstration needs
no sign-in or database; only synthetic data is available there. Run `npm run dev`
and open `http://localhost:3000/email-demo` (use the assigned port in a worktree).
The banner explicitly labels sample data and predefined results. No tasks or
reminders are created. `src/server/email/demo.ts` owns the fixtures, and runs them
through `readEmailPage` and `readEmail` before rendering.

The separate authenticated `/email` page now connects Gmail through OAuth and
offers a manual read-only inbox preview. See [`gmail-setup.md`](gmail-setup.md)
for credentials, database setup, token handling and current limits. It does not
yet persist imported messages, monitor mail, run email AI extraction or create tasks.
Use university/team-approved infrastructure; personal
API keys and personal paid cloud accounts remain prohibited.

## Jira tickets

Epic: [KAN-47 — Module 2 - Turn incoming email into tasks and reminders](https://day-keeper-group-1.atlassian.net/browse/KAN-47), In Progress.
Created and verified in Jira on 10 September 2026. All eight tickets below belong
to this epic, with dependency links matching the table. No sprint or assignee
has been selected.

| Order | Jira ticket | Status at creation |
|---|---|---|
| 1 | [KAN-48](https://day-keeper-group-1.atlassian.net/browse/KAN-48) | In Review — foundation implemented locally; uncommitted, no PR yet |
| 2 | [KAN-49](https://day-keeper-group-1.atlassian.net/browse/KAN-49) | To Do |
| 3 | [KAN-50](https://day-keeper-group-1.atlassian.net/browse/KAN-50) | To Do |
| 4 | [KAN-51](https://day-keeper-group-1.atlassian.net/browse/KAN-51) | To Do |
| 5 | [KAN-52](https://day-keeper-group-1.atlassian.net/browse/KAN-52) | To Do |
| 6 | [KAN-53](https://day-keeper-group-1.atlassian.net/browse/KAN-53) | To Do |
| 7 | [KAN-54](https://day-keeper-group-1.atlassian.net/browse/KAN-54) | To Do |
| 8 | [KAN-55](https://day-keeper-group-1.atlassian.net/browse/KAN-55) | To Do |

| Order | Type / title | Acceptance criteria | Depends on |
|---|---|---|---|
| 1 | Task: Establish email ingestion and extraction contracts | Server-only mailbox interface, repeatable mock pages, validated email input, action/no-action results and reuse of the six-field validator. Initial implementation is in this change. | — |
| 2 | Spike: Select mailbox provider and obtain approved application access | Choose Outlook or Gmail; verify university tenant permissions and approved app ownership; document consent, minimum read permissions, initial import window and test accounts. No personal paid account or API key. | — |
| 3 | Story: Connect and disconnect a mailbox securely | Authenticated connection and callback; OAuth state validation and applicable PKCE; server-side encrypted token storage and rotation; reconnect on revoked access; disconnect prevents future reads; another user cannot access the connection. | 2 |
| 4 | Story: Import email reliably | Provider adapter decodes plain text/HTML safely without loading remote content; mailbox-scoped unique provider message IDs prevent duplicates; checkpoint advances only after persistence; retry, pagination, expired cursors and rate limits are covered. Bound initial history and message size. | 1, 3 |
| 5 | Story: Extract actions, deadlines and contacts from email | Approved model adapter validates the shared six fields; no-action mail creates no task; uncertain values stay hidden; email content cannot instruct tools or trigger outbound actions; fixtures cover bills, appointments, newsletters and missing dates. Define contact representation before promoting it from open_payload. | 1, 2 |
| 6 | Story: Show email actions in the unified archive and task flow | Define email source persistence without inventing photo pages; preserve the read-only review rule and explicit confirmation; create tasks/reminders transactionally using planReminders; source links work; retry cannot duplicate tasks; ownership enforced. | 4, 5 |
| 7 | Story: Monitor connected mailboxes | A scheduler polls eligible connections with bounded batches, per-connection locking and safe retries; revoked connections stop; failures can be retried without lost or duplicate messages; no message bodies or tokens in logs. | 4, 6 |
| 8 | Task: Verify the complete email journey and retention | Test connect → import → review → confirm → reminder → complete, disconnect and reconnect, isolation between users, duplicate deliveries and model failure; document retention/deletion of source emails and credentials. | 3–7 |

## Design decisions for implementation

Persist connections and imported messages separately from photograph pages. Each
query must be scoped by the signed-in user's ID, and a unique key must include
the connection ID and provider message ID. Cursors belong to that connection.
The current mock only exercises page reads; it does not provide persistence or
deduplication. Those guarantees belong to ticket 4.

Adapters produce plain text from MIME/HTML. The initial foundation does not
process attachments, send replies, modify mail, or follow links from messages.
Decide separately whether attachment extraction belongs in a later release.
Never render raw email HTML in the app. Invalid or oversized input must be
recorded as an import failure by the future worker without logging the body.

Keep real model output subject to `parseExtractionResult` (used through its
schema in the email reader). Reuse the existing date rules and reminder ladder
when task creation is added. Decide and test multiple-action emails before
expanding the first adapter beyond one actionable result per message.
