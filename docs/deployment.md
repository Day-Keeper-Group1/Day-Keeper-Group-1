# Deployment (trial, KAN-75)

Status (2026-09-26): runs end to end, phone included. It is a practice run on branch `kan-75-vercel-trial`, for Sai to review and the team to decide whether to adopt. The trial went in five stages, named below: 1 choose the platforms, 2 register the accounts, 3 the laptop against the hosted database and storage, 4 the app on Netlify, 5 a phone.

This file holds no passwords, keys or connection strings with a password in them. Those live in the team's Teams channel, under internal documents, which only the group can open.

## For agents: this file is a snapshot, the platforms are the truth

This file is written for two readers: a teammate new to deployment, who needs the reasons, and an AI agent working for them, who needs the current state. It describes the setup as it was on the date at the top of each section. Settings change and notes fall behind, so before acting on anything below, read the live state from the platform and treat any difference as the platform being right and this file being out of date. Then tell the person, so the file gets fixed.

How to read the live state without opening a browser:

- **Supabase: the official MCP server.** Add it to the agent with this URL: `https://mcp.supabase.com/mcp?project_ref=nnzsgsasrsmsjybouyfv&read_only=true&features=database,storage,debugging,docs,development`. `project_ref` confines it to the `daykeeper` project, `read_only=true` runs every SQL query as a read-only Postgres user, and `features` switches on the storage tools, which are off by default. Authentication opens a browser once to sign in to Supabase with the project mailbox and choose the organization `DayKeeper Group 1`. Useful tools: `list_tables`, `execute_sql`, `list_storage_buckets`, `get_storage_config`, `get_advisors`. `read_only` covers SQL only; `update_storage_config` can still write, so do not call it without the person asking. Docs: https://supabase.com/docs/guides/getting-started/mcp
- **Supabase: the Management API**, for places where a browser sign in is impossible. It takes a personal access token, which carries the full rights of the account, so it is a key and lives with the others in Teams. Docs: https://supabase.com/docs/reference/api/introduction
- **Netlify: the CLI.** `netlify env:list --context <context>` lists the environment variables one deploy context has (secret values stay hidden); `netlify logs --deploy-id <id> --json` gives a deploy's function log, where each invocation ends with a `Duration: … ms` line; `netlify api listSiteDeploys --data '{"site_id":"c8f99029-c5b1-448a-861c-4d1621e4b2cf","per_page":1}'` gives the newest deploy's id. Signing in (`netlify login`) uses the project mailbox. Docs: https://cli.netlify.com/

Every one of these needs a sign in or a token. The agent gets it from the person, and the person gets it from the keys document in Teams.

The Supabase MCP server above was added to Jason's Claude Code on 2026-09-25 as `supabase-daykeeper` (user scope) and authorised with the project mailbox. The authorisation screen grants read access to database, secrets, edge functions, environment, organizations, projects, analytics and storage in `DayKeeper Group 1`.

### Advisor warnings you will see, and why they do not apply (checked 2026-09-25)

`list_tables` and `get_advisors` report a **critical** "Row Level Security is disabled" on all 11 tables, saying anyone with the anon key can read or change every row. That check only looks at the RLS flag. Two other locks already stop that:

1. The Data API is off, so the anon key has no way in.
2. The Supabase API roles have no rights at all. `db/schema.sql` drops and recreates the `public` schema, which removes the grants Supabase gives them by default. Verified with:

```sql
select r.rolname,
       has_schema_privilege(r.rolname, 'public', 'USAGE') as schema_usage,
       has_table_privilege(r.rolname, 'public.users', 'SELECT') as users_select
from pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role');
```

Every value came back `false`. If either lock is ever opened (the Data API switched on, or grants added), this warning becomes real.

**Decided 2026-09-25 (Jason): do not enable RLS for now. Agents: do not add it, and do not run the advisor's remediation SQL, without asking.** The reasoning: DayKeeper's browser never talks to the database. It talks to our own server, which connects as the tables' owner and enforces all three layers in code: every endpoint checks the session, accounts carry a role, and every query is scoped to the signed in person. RLS is Supabase's answer for products whose browser queries the database directly, which ours does not. Adding it now would be overengineering. Once real people use a deployed DayKeeper it should be revisited for defence in depth.

The advisor also warns (level WARN) that the function `public.touch_updated_at` has a mutable `search_path`. It is a hardening suggestion for `db/schema.sql`, not a problem in use.

## Why Netlify and not Vercel (2026-09-25)

Vercel was the plan. Its email sign up stops at a mandatory phone verification: every Vercel account must verify a phone number, a number can belong to one account only, and it cannot be removed without emailing Vercel support ([1](https://community.vercel.com/t/need-to-remove-phone-number-from-my-account/46086), [2](https://community.vercel.com/t/sign-up-issue-phone-number-is-already-associated-with-a-vercel-account/42270), [3](https://vercel.com/kb/guide/why-can-i-not-signup)). Jason decided not to tie a team member's phone to a project account, and not to spend money on a second number, for a school project. Throwaway SMS numbers were ruled out: they defeat the check the platform relies on, and the codes are visible to anyone.

Render was ruled out because its free web services ask for a credit card ([1](https://render.discourse.group/t/render-request-my-credit-card-for-free-web-service/35848), [2](https://feedback.render.com/features/p/credit-card-required-for-free-plan)).

Netlify signed up with the project mailbox and asked for neither a phone number nor a card. What it means for DayKeeper, from Netlify's own documentation:

- **Supported:** Next.js App Router, route handlers and `after()` ("asynchronous work with `next/after`: Full Support"), tested against every Next.js release. https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- **A request body of about 4.5 MB at most** (6 MB buffered, about 4.5 MB for binary uploads). A bigger request is refused at Netlify's edge with an empty 400 after 64 KB, before our code runs; on 2026-09-26 a phone's browser did not notice and sat on "Sending..." for good. Solved in code (see "Code the deployment needed"): the photographs no longer go through the app at all.
- **30 seconds per request, background work included.** Netlify's documentation says 60 for synchronous functions; what our deploy actually does, measured on 2026-09-26, is stop the invocation at exactly 30000 ms. `after()` runs inside the same invocation, so reading a letter counts against it. A round of the reading scheme takes 10 to 25 seconds, so a letter that needed a second round was stopped half way and said "reading…" for good. Solved in code: one round per request. Vercel allows 300. https://docs.netlify.com/build/functions/configuration/
- **Functions run in US East (Ohio) on the free plan.** Choosing a region, Sydney included, is a Pro feature. With the database in Sydney every query crosses the Pacific. If that proves too slow, the fix is a second Supabase project in US East next to the functions (the free plan allows two projects).
- **300 credits a month, hard limit.** A production deploy costs 15 credits; deploy previews and branch deploys cost none; function compute is 10 credits per GB hour, which a reading barely touches. When credits run out every site on the team is paused until the next month; nothing is charged. So test with preview deploys and make a production deploy only for demonstrations. https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
- **To check at deploy time:** in Lambda compatibility mode the total of all environment variables may not exceed 4 KB, and `DATABASE_CA_CERT` alone is about 1.4 KB. The Next.js adapter should not use that mode. https://docs.netlify.com/build/functions/environment-variables/

## Deploying to Netlify (stage 4, 2026-09-25)

The CLI is `netlify-cli`, installed globally with `npm install -g netlify-cli` (on Jason's machine it lives in `D:\develop\NodeJs`, about 258 MB). npm 11 blocks its install scripts by default; the CLI works without them.

Steps, all from the repository root:

1. `netlify login`. It prints a URL; open it in the browser that is signed in to the project Netlify account and press Authorize. Each shell environment that runs the CLI needs its own login: Jason's terminal and the agent's shell did not share one.
2. `netlify sites:create --account-slug daykeeper-group1 --name daykeeper-group1`. Creates an empty project with no Git connection and links the folder to it by writing `.netlify/state.json`. The CLI also adds `.netlify` to `.gitignore`. Project URL https://daykeeper-group1.netlify.app, admin https://app.netlify.com/projects/daykeeper-group1.
3. Environment variables (see the table below). Set with `netlify env:set NAME value`. `DATABASE_CA_CERT` cannot go that way: its value starts with `-----`, which the CLI reads as an option, and PowerShell swallows the usual `--` separator. `netlify env:import <file>` with a one line dotenv file works. `AZURE_OPENAI_API_KEY` was entered by Jason in the web UI (Project configuration, Environment variables, Add a variable, Add a single variable) with **Contains secret values** ticked. Ticking it forces specific scopes (builds, functions, runtime; post processing is excluded, which is fine because the app runs as functions) and a value per deploy context: fill **Production** and **Deploy Previews**, leave the rest empty. A secret cannot be read back, not even by the CLI. On 2026-09-26 a value for **Branch deploys** was added too (Jason, same key), because a deploy with `--alias` is a branch deploy, and without it the reader failed with "AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must both be set". So three contexts are filled: Production, Deploy Previews, Branch deploys. Preview Server & Agent Runners and Local development stay empty. After changing a variable, deploy again; a running deploy keeps the values it was built with.
4. Stop `npm run dev` in the same folder first. The dev server holds files in `.next`, and on Windows the Netlify plugin then fails with "Failed publishing static content" when it tries to rename `.next`.
5. `netlify deploy --skip-functions-cache --alias kan75`. Builds (about 1.5 minutes), lets the Next.js plugin arrange what is published, uploads, and prints a **Draft URL**. Without `--prod` it costs no credits. With `--alias kan75` the URL is always https://kan75--daykeeper-group1.netlify.app, so a phone stays signed in from one deploy to the next; without it every deploy gets a new URL like `https://6ab755ffc11a33d1f7096e04--daykeeper-group1.netlify.app` and a new sign in.

Mistakes made on the way, so nobody repeats them:

- **Turbopack builds on Windows do not work on Netlify.** Next.js 16 builds with Turbopack by default, which refers to `pg` and the AWS SDK through hashed aliases in `.next/node_modules` (for example `pg-587764f78a6c7a9c`). On Windows those are directory junctions, the plugin does not carry them into the function, and the deployed function fails with `ERR_MODULE_NOT_FOUND`: every request that touches the database answers 500 with an empty body, and sign in shows "We could not sign you in just now". The function log (`netlify logs --deploy-id <id> --json`) names the missing package. Fixed by `netlify.toml` in the repository root, which sets the build command to `next build --webpack`. Local development still uses Turbopack.
- **Do not use `netlify deploy --no-build` after a separate `netlify build`.** It skipped the plugin's publishing step, tried to upload the whole `.next` folder (2442 files instead of 44), and reused the previous, broken function from cache. It was stopped before it finished; nothing went live.
- **New projects are Private.** Anyone not signed in to the Netlify team gets 401 on every URL, including the draft URL, and on the free plan the team has one member. The **Make public** button on the project page stays greyed out ("Available after your first successful deploy") until there has been a production deploy, which costs 15 credits. Instead, on 2026-09-26: Project configuration, General, Visitor access, **Edit visibility**. The form opened on Visibility "Customize this project's visibility", Private, Applies to "Production and previews". Changed Private to **Public** and saved; Applies to then greys out, and both lines read Public. There is no way to keep production private and make previews public: "Previews only" makes production public regardless. Production has never been deployed, so its URL is an empty 404. **The change took three to five minutes to reach the edge**: 401 at 14:07, 200 at 14:09.
- **`npm run lint` fails after a deploy** until `.netlify/**` is ignored: the deploy leaves built output there. Now in `eslint.config.mjs`.
- **An alias deploy is a branch deploy**, a context of its own for environment variables. See step 3.

## Where each piece runs

| Piece | Locally | Deployed | State |
|---|---|---|---|
| The app | `npm run dev` on a laptop | Netlify, Free plan, functions in US East (Ohio) | Preview deploys only, at https://kan75--daykeeper-group1.netlify.app |
| Database | Postgres in Docker, port 15432 | Supabase, Free plan, Sydney | Schema and seed loaded |
| Photographs | MinIO in Docker, port 19020 | Supabase Storage in the same project, over its S3 protocol | In use; the phone uploads straight into it |
| Reading letters | Azure OpenAI | Azure OpenAI, unchanged | Already in the cloud |

The code does not know where any of these are. It reads their addresses and credentials from environment variables, so the same code runs against Docker on a laptop and against the hosted services, and deploying means filling in a second set of variables rather than changing code.

Docker is only for local development. Nothing in the cloud runs a container: Netlify takes the built app and runs Next.js itself, and Supabase runs Postgres for us.

## Code the deployment needed

An earlier draft (22 September) planned Vercel Blob for photographs, so that they could go from the phone straight into storage and never through the app. Blob does not speak S3, so that draft needed a second storage implementation. By 24 September main already had three things that make a hosted S3 bucket a matter of configuration:

- `STORAGE_REGION` is an environment variable. It used to be hard coded as `us-east-1`, which MinIO ignores and a hosted bucket rejects.
- `signedUploadUrl()` and `getObject()` in `src/server/storage.ts`, and `src/server/image-type.ts`, are the pieces for letting the browser upload straight into the bucket and checking afterwards what landed. On 24 September nothing called them; that was only found on 25 September.
- `DATABASE_CA_CERT` lets the app verify a hosted Postgres certificate. See `.env.example`.

Running on Netlify then took four commits on branch `kan-75-vercel-trial`, each found by trying:

1. **`484fb4f6` Build with webpack** (`netlify.toml`). See "Mistakes made on the way".
2. **`e98aea68` Shrink photographs over 1 MB in the browser** (`src/lib/photos.ts`). At or under 1 MB a photograph is sent untouched, so a small file from a poor camera is not squeezed further. Over it, the long side is drawn at 3508 pixels, the size of the synthetic A4 pages at 300 dpi that the reader was measured on, never smaller; then only the JPEG quality goes down, from 0.85 to 0.5. A phone photograph of a page on a computer screen still comes out near 2 MB at 0.5 (moiré and sensor noise), and it is sent at that size rather than shrunk further. Checked on the iPhone that its browser does honour the quality setting.
3. **`141da32e` Send photographs straight to the bucket.** The capture screen asks `POST /api/documents/uploads` for a letter id and one signed upload link per page, PUTs each photograph to its link, then posts the id to `POST /api/documents` as JSON. The app sees a few lines of JSON; the photographs go from the phone to Sydney without crossing to Ohio. The server derives every key from the signed-in person, reads the first 12 bytes of each object to check it arrived, its size, and that it is the image type declared, and removes the lot if any page fails. The old multipart upload still works for curl and Swagger. The storage client no longer signs a body checksum into links. Supabase and local MinIO both accept a signed PUT from a browser page (CORS checked with a real PUT against each on 2026-09-26).
4. **`1c114a29` Read a letter one round per request.** Because of the 30 second limit. The upload reads round 1 after answering; a round that decides nothing queues the next, and `GET /api/home`, which the screen polls every five seconds while anything is being read, reads it after answering (`continueReadings` in `src/server/uploads.ts`). A round still processing two minutes after it started is taken as stopped by the host and counts as a round that decided nothing. Rounds are only closed while still processing, so two polls cannot both queue a successor. Consequence: a letter whose person closes the app mid-reading waits, queued, until they open it again.

## Accounts

Every platform account is registered under one project mailbox, `daykeeper.group1@proton.me`, which belongs to no team member. Handing the deployment over means handing over that mailbox. No credit card is attached anywhere, and none may be: the course bans personally paid cloud accounts.

| Platform | Registered | Notes |
|---|---|---|
| Proton Mail | 2026-09-24 | The project mailbox. Gmail refused the phone number, Proton needs none. |
| Supabase | 2026-09-24 | Signed up with the mailbox, not with GitHub. Organization `DayKeeper Group 1`, Free plan. |
| Vercel | Not registered | Stopped at the mandatory phone verification, see "Why Netlify and not Vercel". |
| Netlify | 2026-09-25 | Signed up with the mailbox; no phone, no card. Team `DayKeeper Group 1`, Free plan, project `daykeeper-group1`. |

## Supabase project

| Setting | Value |
|---|---|
| Project name | `daykeeper` |
| Project ref | `nnzsgsasrsmsjybouyfv` |
| Project URL | https://nnzsgsasrsmsjybouyfv.supabase.co |
| Region | Oceania (Sydney), `ap-southeast-2` |
| Compute | Nano (free) |

Choices made when the project was created, and why:

- **GitHub not connected.** That feature manages the schema through GitHub, which we do not use, and connecting it would tie the project to someone's personal GitHub account.
- **Enable Data API turned off.** It publishes every table as a web API. The app talks to Postgres directly through `pg` and never uses Supabase's client library (`@supabase/supabase-js` appears nowhere), so the API would only be an extra way in, next to a `users` table that holds password hashes. With it off, "Automatically expose new tables" and "Enable automatic RLS" have nothing to act on.
- **Database password generated by Supabase.** Letters and digits only, so it can sit inside a connection string without escaping. It is different from the mailbox password on purpose: it gets copied into `.env.local` and into Vercel, and a leak there should cost only the database.
- **Advanced configuration left at defaults.**

## Connecting to the database

Supabase offers three connections. We use the **Transaction pooler**.

| Connection | Port | Reachable over | Fits |
|---|---|---|---|
| Direct connection | 5432 | IPv6 only on the free plan | Long running servers on IPv6. Vercel cannot reach it. |
| Session pooler | 5432 | IPv4 | Long running servers on IPv4 |
| **Transaction pooler** | **6543** | **IPv4** | Serverless functions, where each request is a short lived copy of the app |

The pooler keeps connections to Postgres open and lends one out per transaction, so a freshly started function does not pay for a new connection each time. The app opens at most one connection per copy when the database is not local (`max: isLocal ? 10 : 1` in `src/server/db.ts`), which is what the transaction pooler expects.

The connection dialog warns "Transaction pooler uses IPv6 by default". That refers to the paid dedicated pooler. The shared pooler we use resolves to IPv4 addresses (checked 2026-09-25), so the IPv4 add-on is not needed.

Where to find it: the green **Connect** button at the top of the dashboard, then **Direct**, then **Transaction pooler**, type **URI**. The dialog shows `[YOUR-PASSWORD]` in place of the password; substitute the database password.

The shape of the variable, password left out:

```
DATABASE_URL=postgresql://postgres.nnzsgsasrsmsjybouyfv:<database password>@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
```

The user name carries the project ref (`postgres.<ref>`) because the shared pooler serves many projects and needs to know which one you mean.

### The certificate (`DATABASE_CA_CERT`)

The app always encrypts a connection to a database that is not local, and it checks who answered (`remoteTls()` in `src/server/db.ts`). Supabase's pooler presents a certificate signed by Supabase's own root, which is not in Node's default list of trusted signers, so without help the first query fails with `SELF_SIGNED_CERT_IN_CHAIN` before anything is sent: no password, no query. In the app this shows as "Something went wrong at our end" on sign in, and the terminal shows the real error. Seen and fixed on 2026-09-25.

The fix is configuration only: give the app Supabase's root certificate.

- Where to get it: Database (left bar), Configuration, **Settings**, then **SSL configuration**, **Download certificate**.
- The file is `prod-ca-2021.crt`, 23 lines, subject "Supabase Root 2021 CA". A copy is kept with the keys in Teams as `supabase-prod-ca-2021.crt`.
- It is **not a secret**. It is the signer's public certificate, the same for every Supabase user, and it can only be used to check Supabase's identity. It can live in the repository.
- Put the whole file in `.env.local` inside straight double quotes, line breaks kept: `DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----` on the first line, the body, and `-----END CERTIFICATE-----"` on the last. Typographic quotes (as a Chinese or smart-quote input method produces) break it; the app says so.
- Restart `npm run dev` afterwards: the connection pool is built once, with the settings it saw first.
- Who needs it: anyone whose laptop connects to Supabase (including anyone running the `db:` scripts against it), and Netlify. Teammates developing against local Docker do not; that Postgres does not use TLS.
- Do not set `DATABASE_SSL_NO_VERIFY=yes` instead. It keeps encryption but stops checking identity, which is what the certificate exists to do.

After the certificate, signing in as Margaret worked from the laptop against Supabase, and a new row appeared in `sessions` on Supabase.

## Building the schema on Supabase

Done on 2026-09-25. The tables come from `db/schema.sql`, the same file that builds the local database.

1. In `.env.local`, comment out the local `DATABASE_URL` and add the Supabase one below it.
2. In `.env.local`, uncomment `DK_ALLOW_REMOTE_RESET=yes`.
3. Run `db:schema` from VS Code's NPM Scripts panel in the Explorer sidebar. Not `db:reset`, the line above it, which also empties the photograph bucket and loads the seed.
4. In `.env.local`, comment `DK_ALLOW_REMOTE_RESET=yes` out again straight away.

It printed `Schema rebuilt from db/schema.sql.`, and the Table Editor shows 11 tables and 1 view (`document_reading_totals`).

What `db:schema` does, in order (`db/reset.ts`):

1. Reads `DATABASE_URL` from `.env.local`.
2. **First guard.** If the host is not on this machine (`src/lib/local-host.ts` keeps the list), it refuses unless `DK_ALLOW_REMOTE_RESET` is exactly `yes`.
3. **Second guard.** If the `users` table holds any address outside `@example.com`, someone registered through the app, and it refuses unless `DK_DESTROY_REAL_ACCOUNTS` is exactly `yes`. A fresh database has no `users` table and passes. See `db/real-accounts.ts`.
4. Sends `db/schema.sql` in one transaction: drop the `public` schema with everything in it, create it again, create every table. All of it happens or none of it does.
5. Prints the line above.

It builds empty tables and nothing else. It does not load the seed (`db:seed` does that) and it does not touch photographs.

Two consequences worth knowing:

- Running it again wipes every row. Photographs already in the bucket stay there with nothing pointing at them.
- Once real people have registered on the deployed app, the second guard blocks it even with the first switch on. That is intended.

The project has no migrations: every change to the database rebuilds it from `db/schema.sql`. That is safe only while no data needs keeping, and `db/schema.sql` says so at the top.

## Loading the seed on Supabase

Done on 2026-09-25, straight after the storage below was set up, the same way as the schema: uncomment `DK_ALLOW_REMOTE_RESET=yes`, run `db:seed` from the NPM Scripts panel, comment it out again. `db/seed.ts` carries the same two guards as `db/reset.ts`.

It wrote 7 accounts (Margaret, the operator and one per teammate, all `@example.com`), 5 letters with 9 pages, 5 tasks and 15 reminders, and uploaded 9 photographs (5.22 MB) into the `daykeeper` bucket, one per page. So the laptop reached both the Supabase database and Supabase Storage with the keys in `.env.local`. Checked through the Supabase MCP server.

Why the seed rather than registering an account through the app: the final demonstration signs in as Margaret anyway; the seed exercises storage as well as the database; and seeded accounts are all `@example.com`, so rebuilding later is not blocked by the real accounts guard. The seeded passwords are written in the repository (`README.md`, `AGENTS.md`, `docs/start-here.md`, and the teammates' ones in `db/seed.ts`) and the repository is public, so anyone can sign in as these accounts on a deployed copy. That is acceptable for synthetic data and needs a decision before anything real is stored there.

## Stage 3 result: the laptop against Supabase, end to end

Done on 2026-09-25, 09:50 to 09:59 Melbourne time, with `npm run dev` on the laptop and every database and storage setting in `.env.local` pointing at Supabase, reader `azure`.

1. Signed in as Margaret. A row appeared in `sessions` on Supabase.
2. Uploaded the synthetic electricity bill (`data/synthetic-letters/01-electricity-bill`, two pages) through Photograph. Both photographs landed in the `daykeeper` bucket byte for byte (640213 and 646144 bytes). They travelled through the app (`/api/documents`), not straight from the browser, so this says nothing about CORS on the bucket.
3. The reader fetched them back from the bucket and read the letter: two `gpt-5.6-luna` calls that agreed, no judge, 11.6 seconds, about US$0.011. Issuer Example Energy, due 2026-11-02, amount $81.29, all matching `ground-truth.json`.
4. Confirmed. The document became `confirmed`, a task "Pay Example Energy" due 2 November was created with three reminders at 09:00 on 26 October, 30 October and 1 November (the 7, 3 and 1 day ladder), and the calendar showed it on 2 November.

## Stage 4 result: the app on Netlify (preview)

2026-09-25, preview deploy https://6ab5e8f52660175d1217b85e--daykeeper-group1.netlify.app (still Private, so only a browser signed in to the Netlify team can open it).

- An empty sign in request answered 400 "Please fill in both boxes." from our own code, so the function loads.
- Signed in as Margaret; a new row appeared in `sessions`. The dashboard shows the same data as the laptop, because both use the same Supabase database.
- Uploaded the synthetic gas bill (`data/synthetic-letters/02-gas-bill`, two pages, 635092 and 692276 bytes). Timeline in Melbourne time: Read it pressed 13:31:12.9, letter stored 13:31:34.8 (22 seconds, the photographs travel through the function in Ohio), reading 13:31:36.0 to 13:31:50.2 (14.1 seconds, two luna calls that agreed, no judge, about US$0.007). About 37 seconds from button to "ready to check". Issuer, due date 2026-11-06 and amount $257.36 all match `ground-truth.json`.

## Stage 5 result: a phone, end to end (2026-09-26)

An iPhone 14 on the home network, in its web browser, photographing synthetic letters shown on the laptop screen (all from the fifteen in `experiments/module-01-extraction/09-contact-has-a-due-date/letters.txt`). Timings from the phone screen (read about every three seconds), the Supabase rows and the Netlify function log.

- **Sign in** from the phone: about 4 seconds. From the laptop, the first sign in after a quiet spell took 5.3 seconds and the next two 1.25 and 0.95: the function starts in Ohio and opens a new connection to Sydney. Reaching Netlify's edge itself takes 0.03 seconds.
- **Before any fix**, the gas bill, two phone photographs: stuck on "Sending..." for over 100 seconds, no invocation in the function log. Reproduced from the laptop: 8 MB refused with an empty 400 after 64 KB.
- **After shrinking**, the water bill, two pages: stored at 1.9 and 2.0 MB (2631 by 3508), right way up, 12 to 15 seconds to send, read in 10.8 seconds, every field right.
- **After direct upload**, the private health statement, three pages, 6 MB in all: sent in 8 to 11 seconds, bucket straight from the phone. Round 1 then disagreed on the identifiers and round 2 was stopped at 30000 ms (the reason for commit 4).
- **After one round per request**, the same letter again: sent in 11.5 seconds; round 1 (18 s, in the upload's request) and round 2 (17 s) disagreed on the identifiers, round 3 (17 s) decided. Each queued round was picked up by the next poll within 6 seconds. About 70 seconds from Read it to "ready to check". Longest invocation in that deploy's log: 23.3 seconds.
- From the laptop, the same fixes with generated "phone" photographs (3024 by 4032, noisy, 2.7 to 2.9 MB each): two pages shrunk to 823 and 904 KB and sent in 6.4 seconds through Netlify; three pages sent straight to the bucket in 2.1 seconds on the local server.

**Reading accuracy** (compared with `ground-truth.json`): of the seven letters read on 25 and 26 September, six had every field right. The seventh, the three page health statement photographed off the screen and read in three rounds, gave the issuer as "Tamwell Health Fund" instead of "Tarnwell", marked confirmed: "rn" read as "m". The same letter from generated photographs was read right. So the photographs a phone takes of a screen are less legible than the pages the scheme was measured on; that belongs to the photo quality experiments (KAN-76), not to the deployment.

Two letters from these tests stayed failed on purpose: one whose round 2 was stopped by the host (marked failed by hand), and one read on the alias deploy before its Azure key existed.

## Reset on 2026-09-26

After the phone tests Margaret's inbox held nine test letters, and main had meanwhile changed `db/schema.sql` (KAN-62, reminders as days marked on Home), so the deployed code and the hosted tables no longer matched. With the scripts encrypted, `npm run db:reset` was run against Supabase with `DK_ALLOW_REMOTE_RESET=yes` set for that one command in the shell rather than in `.env.local`. It rebuilt the schema, emptied the bucket (31 objects) and loaded the seed: Margaret's three reminders are counted from 26 September. Every account and every test letter went with it; the real accounts guard found none to protect. The merged code was deployed to the `kan75` alias straight after, because the old deploy expected the old tables.

## Photograph storage on Supabase

Set up on 2026-09-25, in the same Supabase project.

### The bucket

The app never creates its bucket; it expects one to exist under the name in `STORAGE_BUCKET`, which defaults to `daykeeper` (`src/server/env.ts`). Only the seed and reset scripts create buckets, and only for local MinIO. So the bucket is created by hand: Storage, Files, **New bucket**. The dialog has one field and three switches:

| Setting | Chosen | Why |
|---|---|---|
| Bucket name | `daykeeper` | Matches the default of `STORAGE_BUCKET`. It cannot be changed after creation. |
| Public bucket | **Off** | These are photographs of people's letters. With it off, a photograph can only be opened through a temporary link the app signs, which is how `src/server/storage.ts` already works. With it on, anyone holding the address could open it. |
| Restrict file size | Off | The free plan already caps a file at 50 MB, far above any phone photograph. |
| Restrict MIME types | Off | The app checks the bytes itself (`src/server/image-type.ts`). A second list here could turn away formats such as HEIC from iPhones. |

The bucket list then shows `daykeeper` with 0 policies, a 50 MB limit and any MIME type. The policies column is about access through Supabase's own client library, which the app does not use; access over S3 with an access key does not go through those policies, so 0 is correct.

### The S3 connection

Storage, Configuration, **S3**:

- **S3 protocol connection** is on by default. It must stay on: the app talks to storage over S3.
- **Endpoint** goes into `STORAGE_ENDPOINT`: `https://nnzsgsasrsmsjybouyfv.storage.supabase.co/storage/v1/s3`
- **Region** goes into `STORAGE_REGION`: `ap-southeast-2`. MinIO ignores the region, which is why a local `.env.local` usually has no such line and falls back to `us-east-1`. Supabase does not ignore it; a wrong region comes back as a signature mismatch.

### The access key

Same page, **New access key**. The only field is a description, a label for recognising the key later; we used `DayKeeper app`. Supabase then shows two values:

- **Access key ID**, the shorter one, goes into `STORAGE_ACCESS_KEY`. It says who is asking.
- **Secret access key**, the longer one, goes into `STORAGE_SECRET_KEY`. It proves it.

The secret is shown once. Copy it into the keys document before pressing Done; if it is lost, delete the key and create a new one. The dialog warns that an S3 access key can do anything to every bucket and bypasses all policies, so it is as sensitive as the database password and belongs only in the keys document in Teams.

## Environment variables for the deployed app

Filled in as each stage gets there.

| Variable | Deployed value comes from | State |
|---|---|---|
| `DATABASE_URL` | Supabase, Transaction pooler, see above | Known |
| `DATABASE_CA_CERT` | Supabase, Database, Settings, SSL configuration, Download certificate | Needed; known (not secret) |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | Supabase Storage, see "Photograph storage on Supabase" | Known |
| Azure reader settings (`AI_EXTRACTION_PROVIDER`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`) | The school's Azure key, entered by Jason as a secret for Production, Deploy Previews and Branch deploys | Set |
| `SESSION_TTL_DAYS` | Same as local | Set |

## Free plan limits

Checked on the providers' own pages on 2026-09-24.

- **Netlify Free (credit based):** 300 credits a month; a production deploy costs 15, previews and branch deploys nothing. Functions in US East only. A request is stopped at 30 seconds (measured) and a request body over about 4.5 MB is refused. See "Why Netlify and not Vercel".
- **Vercel Hobby** (not used): personal, non commercial use only. A request may run for 300 seconds. https://vercel.com/docs/plans/hobby
- **Supabase Free:** 500 MB database, 1 GB file storage, 5 GB egress a month, files up to 50 MB, two active projects. **A project with no activity for a week is paused.** The data stays, but the site cannot reach the database until someone restores the project from the dashboard; open it the day before any demonstration. https://supabase.com/pricing
- Supabase Storage speaks S3 and supports presigned URLs once the S3 connection is enabled in its Storage settings. https://supabase.com/docs/guides/storage/s3/compatibility

## Open items

- **A script that refreshes Margaret only. Deferred on 2026-09-26, and must be written before the first demonstration after any teammate keeps their own data on the deployed database.** Until then `npm run db:reset` with `DK_ALLOW_REMOTE_RESET=yes` does the job, because the hosted database holds nothing but the seed. The seed is for weekly demonstrations and changes with them, and Margaret's three reminders are dated from the day the seed runs, so a deployed copy goes stale within days even when the seed does not change. Both existing scripts wipe everything (`db:reset` truncates tables and empties the bucket; `db:seed` truncates every table but leaves old photographs behind), which is wrong on a hosted database where teammates may have their own test data. The new script deletes Margaret's letters, tasks and reminders and her photographs under `uploads/<her id>/`, then writes her five letters again from the current seed with dates counted from that day. Other accounts are not touched. Same two guards and TLS as the other scripts. Run it against the deployed database before each demonstration.
- **`touch_updated_at` search_path** (advisor WARN): a small hardening change to `db/schema.sql`, not yet decided.
- ~~Encrypt the setup scripts~~: done 2026-09-26, commit `78116a25`. The rule moved from `src/server/db.ts` to `src/lib/database-tls.ts`, and the app's pool and all three scripts use it. Checked: the scripts reach Supabase over TLS 1.3 and local Docker without TLS. The schema build and seed of 2026-09-25 had travelled unencrypted; the reset of 2026-09-26 was encrypted. Next step to consider: Supabase's "Enforce SSL", so an unencrypted connection is refused outright.
- **Keep the project Private between demonstrations.** The seeded passwords are in this public repository, so while the project is public anyone who finds the URL can sign in as Margaret and spend Azure credit on readings. Private, it opens only in a browser signed in to Netlify with the project account (the keys are in Teams). Make it public for a demonstration from a phone, a few minutes ahead, and private again afterwards.
- **A letter whose reader closes the app mid-reading waits** until they open it again, because the next round is read by their own screen's poll. Nothing reads a letter nobody is watching; that needs a real queue or a scheduled function, not decided.
- **Photographs of a screen read less reliably** than the clean pages the scheme was measured on (Tarnwell read as Tamwell, above). For KAN-76.
- ~~Phone photographs will not fit through Netlify~~ (found 2026-09-25): fixed on 2026-09-26 by commits 2 and 3 above.
