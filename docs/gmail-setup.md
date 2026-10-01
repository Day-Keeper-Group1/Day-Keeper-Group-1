# Connect a test Gmail mailbox

The authenticated `/email` page connects one Gmail mailbox per DayKeeper user.
It reads up to 20 inbox messages from the last 30 days automatically when the page opens with Gmail connected. It does not send or alter Gmail messages. Create task explicitly saves the selected
email and runs the project Azure reader, then opens the existing review page.
Only confirming creates a task and reminders; No action creates neither.

## Server configuration

Enable Gmail API, configure External/Testing OAuth, add your mailbox as a test
user, and create a Web application client. Request only
`https://www.googleapis.com/auth/gmail.readonly`. Register this exact redirect:

```
http://localhost:3000/api/email/gmail/callback
```

Add these values privately to `.env.local` (not to `.env.example` or chat):

```dotenv
GMAIL_CLIENT_ID=your-web-client-id
GMAIL_CLIENT_SECRET=your-web-client-secret
GMAIL_REDIRECT_URI=http://localhost:3000/api/email/gmail/callback
GMAIL_TOKEN_ENCRYPTION_KEY=your-64-character-hex-key
```

Generate the encryption key locally, then copy its output into that last value:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the key stable and separate from the database. Changing it makes existing
connections unreadable; reconnect affected mailboxes. Use approved project-owned
credentials. Production requires HTTPS and a deployment secret manager. A
worktree's callback port must match both `.env.local` and Google's registration.

## Database setup

`db/schema.sql` defines `gmail_connections`, `gmail_oauth_attempts` and
`document_emails` (the source of emails explicitly selected for extraction).
Following the repository's no-migrations convention, the normal setup command is
`npm run db:reset`. **It deletes existing local data and rebuilds the seed and
bucket.** Coordinate with anyone using the checkout before running it. This code
change does not automatically reset the shared development database.

Restart `npm run dev`, sign in to DayKeeper, and open
`http://localhost:3000/email`. Select Connect Gmail, select your test account and
grant read-only access. After returning, the inbox loads automatically. For the first test,
send the mailbox a short plain-text message. Choose it in the inbox list to read it.

The registered callback is now implemented. A successful callback returns to
`/email?connection=connected`; failures return `connection=failed` without
echoing codes, tokens or Google error details.

## Behaviour and limits

- OAuth state is user- and browser-bound, expires after ten minutes, and is
  consumed atomically with saving the connection. PKCE protects code exchange.
- Refresh tokens and temporary PKCE verifiers use AES-256-GCM with user/purpose
  binding. Access tokens stay only in request memory. POST routes require the
  configured same origin. All Gmail HTTP replies disable caching.
- Every connection query is user-scoped. Reconnecting replaces that user's
  connection; no Gmail address is hardcoded or assumed to match their login.
- Disconnect deletes stored tokens and pending OAuth attempts. In-flight message
  requests check connection identity before returning. Disconnect does not revoke
  the Google-side grant; remove it through Google account third-party connections
  if required. Already displayed/downloaded content cannot be recalled.
- HTML alternatives are sanitized on the server before display. Emphasis, lists,
  tables and safe links are retained; scripts, images, forms, embedded content and
  arbitrary styles are removed. Links open without opener access or a referrer.
  Plain text is the fallback when HTML is absent, empty or oversized. Attachments
  are not processed. Messages lacking a valid plain-text body or exceeding the schema's
  limits are counted as unsupported, not classified as `no-action`.
- There is no background mailbox polling, pagination UI or automatic import.
  The reading screen polls the selected document until extraction finishes.
  Each inbox visit loads a fresh batch. Create task imports
  only the selected message; a user/mailbox/message unique key prevents duplicate
  readings and tasks. Failed readings may be retried with Create task.
- Google Testing refresh tokens expire after seven days for this scope. Reconnect
  when prompted. Broader deployment requires reviewing Google's verification rules.
- Do not log callback query strings at a reverse proxy: they contain temporary
  authorisation codes. Application errors never log token responses or mail bodies.

## Verification

`npm run -s test` includes mocked Google, extraction and endpoint tests.
`node --conditions=react-server --import tsx scripts/test-email-workflow.ts` creates
and removes a disposable local database to test the full import/review/confirmation
flow without touching the application database. The unit tests use mocked Google
responses and needs no credentials or database. Also run typecheck, lint and build.
Email extraction also requires `AI_EXTRACTION_PROVIDER=azure` and the project
Azure endpoint/key. It reuses the photo voting scheme and the existing review,
confirmation, task and reminder logic. Imported source emails are retained when
Gmail is disconnected so a saved task can still be understood.

Live OAuth still needs the private configuration, initialized database and a human
granting consent. Verify connect, automatic inbox loading, disconnect, reconnect, sign-out and a second
DayKeeper account before demonstrating real mailbox access.
