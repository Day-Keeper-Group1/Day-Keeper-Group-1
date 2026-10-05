# Connect a test Gmail mailbox

The authenticated `/email` page connects one Gmail mailbox per DayKeeper user.
It reads up to 20 inbox messages from the last 30 days automatically when the page opens with Gmail connected. It does not send or alter Gmail messages.
The original formatted email and images are displayed without extraction.
Create Task saves the selected email and runs the project Azure reader, then opens
the existing review page. Open in Gmail opens a new tab targeting the selected
message ID and connected mailbox (`authuser`), using Gmail's `#all` message route.
Only confirming creates a task and reminders; No action creates neither.

An email whose due date or amount is uncertain still fails the AI reading, as photo
uploads do. A decided reading can now be recovered by its owner: Create Task
opens correction inputs for unconfirmed six-field values, with edit icons for all six fields and a document-type dropdown, then Continue to review
shows the updated plan before the ordinary save/confirm step. Valid full dates
and amounts are checked server-side, confirmed fields may also be edited, and
the failed reading and model calls remain intact beside a separate user-corrected
reading and an audit event containing field keys only. Existing failed emails
are supported without rerunning the reader. Provider failures and unresolved
voting results retain the failure screen. For example, a forwarded bill
showing only `25 MAY` without any printed year cannot supply a confident full
date; the forwarding timestamp does not establish the original bill's year.
The user can enter the known full date to continue and save the task.
Embedded graphics do not themselves cause a reading failure. The current reader
uses the plain-text body, including its bill table and payment instructions when
supplied by the sender. Image-only text and document attachments are not read.

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
`document_emails` (the source of emails imported for extraction).
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
- HTML alternatives are sanitized on the server and displayed in an opaque-origin
  sandboxed frame with scripts, forms and embedded documents blocked. Original
  inline CSS, embedded stylesheets, responsive media queries, class names, fonts,
  spacing and image dimensions survive. Email content uses a neutral mail canvas;
  DayKeeper's theme applies to the surrounding controls. External stylesheets and
  web fonts are blocked by CSP; HTTP(S) background graphics and other CSS images
  load when the email is opened. Never insert this HTML into DayKeeper's
  application DOM: the iframe sandbox and CSP are part of its rendering boundary.
  Messages without HTML show their plain text. Wide layouts scroll within the preview.
- Embedded CID images load when a message is opened, through the signed-in user's
  Gmail connection. Only referenced PNG/JPEG/GIF/WebP parts with matching file
  signatures are accepted: up to 8 images, 1 MB each and 4 MB total. Disconnecting
  or replacing a connection prevents pending image responses from being returned.
  Images are not persisted. External HTTP(S) images load when the email is opened;
  this may reveal an open to the sender. Scheme-relative image URLs are normalized
  to HTTPS. Browsers may block insecure HTTP images on an
  HTTPS deployment; expired or sender-protected image URLs can also fail.
  No server endpoint fetches sender-supplied external URLs.
- Plain text remains the extraction input. HTML-only messages and document
  attachments remain unsupported; oversized or unsupported messages are counted
  rather than classified as no-action.
- There is no background mailbox polling, pagination UI or automatic extraction.
  Each inbox visit loads a fresh batch. Create Task imports only the selected email;
  a user/mailbox/message unique key reuses successful readings and prevents duplicate
  tasks. Failed readings can be retried with Create Task. The reading screen polls
  the document until the review page is ready.
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

### Legacy Yarra Valley artwork

Older Yarra Valley bills reference static images under
`http://www.yvw.com.au/yvw/groups/public/documents/images/`. On 5 October 2026,
the header, payment buttons and supporting artwork were verified to redirect to
`https://comms.yvw.com.au/comms/OLD/`. The sanitizer normalizes simple image
filenames from that exact legacy directory to the HTTPS archive. Query-bearing
URLs, other hosts, and payment/account links are unchanged. Artwork still loads
when the email is opened; no bill content or artwork is stored locally.

The correction page uses the inbox email renderer, fetching the original formatted message from the matching connected mailbox. If Gmail is unavailable, the retained plain text is shown instead. Reference help identifies the matching printed identifier when available and otherwise explains which number to quote.

Formatted email previews expand to their full content height, including images loaded later. They scroll with the main page rather than within a separate scrolling frame. The parent measures the script-disabled frame and updates its height when the content or available width changes.

Opening an email letter from Your letters links to `/email?document=<id>` and displays that exact saved message inside DayKeeper, including messages outside the recent inbox window. The lookup checks document ownership and the original mailbox; saved text remains available if Gmail cannot provide the formatted message.
