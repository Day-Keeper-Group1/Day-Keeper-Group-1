# Connect a test Gmail mailbox

The authenticated `/email` page connects one Gmail mailbox per DayKeeper user.
It reads up to 20 inbox messages from the last 30 days on request. It does not
send mail, alter Gmail, store message bodies, call AI, or create tasks. The
public `/email-demo` remains synthetic and never accesses a real connection.

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

`db/schema.sql` now defines `gmail_connections` and `gmail_oauth_attempts`.
Following the repository's no-migrations convention, the normal setup command is
`npm run db:reset`. **It deletes existing local data and rebuilds the seed and
bucket.** Coordinate with anyone using the checkout before running it. This code
change does not automatically reset the shared development database.

Restart `npm run dev`, sign in to DayKeeper, and open
`http://localhost:3000/email`. Select Connect Gmail, select your test account and
grant read-only access. After returning, press Check email. For the first test,
send the mailbox a short plain-text message. Use the expander to read it.

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
- HTML is never rendered, remote content is not loaded, and attachments are not
  processed. Messages lacking a valid plain-text body or exceeding the schema's
  limits are counted as unsupported, not classified as `no-action`.
- There is no background polling, pagination UI, persistent import, or deduplication
  database yet. Each check replaces the displayed batch, so no tasks are duplicated.
- Google Testing refresh tokens expire after seven days for this scope. Reconnect
  when prompted. Broader deployment requires reviewing Google's verification rules.
- Do not log callback query strings at a reverse proxy: they contain temporary
  authorisation codes. Application errors never log token responses or mail bodies.

## Verification

`npm run -s test -- tests/gmail.test.ts tests/email.test.ts` uses mocked Google
responses and needs no credentials or database. Also run typecheck, lint and build.
Live OAuth still needs the private configuration, initialized database and a human
granting consent. Verify connect, check, reconnect, disconnect, sign-out and a second
DayKeeper account before demonstrating real mailbox access.
