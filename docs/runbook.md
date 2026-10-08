# Runbook

What to do, for the deployed site at https://preview--daykeeper-group1.netlify.app. Each entry says what to press or run and links to where the reasons are. Written 2026-10-03 (KAN-86).

The site is Netlify for the app and Supabase for the database and the photographs. [`docs/deployment.md`](deployment.md) is how it was set up, every setting and why, and where the keys are.

## Every day

**Deploy.** Merge a pull request into `main`. The CD pipeline applies any new migration to the database, deploys the code to Netlify, and asks `GET /api/health` whether the site can reach its database. Nothing is deployed by hand. [`deployment.md`, "What a merge to main does"](deployment.md#what-a-merge-to-main-does-kan-86).

**Change the database's structure.** Edit `src/server/db/schema/`, run `npm run db:generate -- --name=<what_changed>`, commit the schema file with what it wrote, open a pull request. The merge applies it. A rename is three migrations, and changing rows is a `--custom` migration. [`src/server/db/AGENTS.md`, "How the database changes"](../src/server/db/AGENTS.md#how-the-database-changes).

**Change what an account holds.** GitHub, Actions, **Demo accounts**, Run workflow, from `main`: **Refresh Margaret**, or **Clear one account** with an `@example.com` address. [`deployment.md`, "Changing what an account holds"](deployment.md#changing-what-an-account-holds-the-demo-accounts-button-kan-86).

## Before a demonstration

1. Open the Supabase dashboard (the project mailbox signs in). A free project with no activity for seven days is paused, and a paused one has to be restored there before the site can reach it. Opening it the day before is enough.
2. Press **Refresh Margaret**, so her three reminders fall on the day.
3. Open the site and sign in as Margaret.

## When something goes wrong

### main is red

The pipeline opens an issue, "main is red: the CI/CD run failed", with the run's link and the command that prints the failed step:

```bash
gh run view <run id> --log-failed --repo Day-Keeper-Group1/Day-Keeper-Group-1
```

The issue says what a failure at each step means. In short: a red **build** means a check or a test failed on main itself; fix it on a branch. A red **Apply new migrations** means nothing changed and nothing was deployed, so the site still runs the version before; PostgreSQL's own message is in the log. Close the issue when main is green again.

### The site is broken after a deploy

Put the code back first, then fix it without hurry.

1. **Code only, no migration in the change:** on GitHub, open the merged pull request and press **Revert**. That opens a pull request that undoes it; merge it, and the pipeline deploys the version before.
2. **Faster, while that is under review:** Actions, **CI/CD**, open the last green run on `main` before the bad one, and press **Re-run all jobs**. It deploys that older commit again. Its migrate step finds nothing to apply, because the database already has every migration that commit knows. The next merge to main deploys main again, so this only holds the site until the fix lands. GitHub re-runs a run for 30 days.
3. **The change included a migration:** do not revert it. Reverting removes the migration file, but the deployed database keeps what it did, and the files and the database stop agreeing. Fix forward instead: a new pull request with the next migration that puts the structure right. A migration only adds, or drops what the code in the same pull request stopped using, so the code before it still runs on the new structure while the fix is written.

### A migration failed in CD

Nothing was applied: everything pending runs in one transaction. Nothing was deployed. Read PostgreSQL's message in the log of **Apply new migrations to the staging database**.

- A refused connection or a timeout: the Supabase project is probably paused. Restore it in the dashboard, then Actions, the failed run, **Re-run all jobs**.
- Anything else: the migration does not fit the data that is there. Fix it in a new pull request (`npm run db:regenerate` on a branch that has not merged yet, or the next migration if it has). `npm run db:rehearse` runs it against a copy built like main, with the seed's rows, before anything is merged.

### GET /api/health answers 503

The site is up and cannot reach its database. Paused project first (above). Otherwise the site's log on Netlify says why (`[health] the database did not answer`): `netlify logs`, or the project's Logs page.

### A letter says "reading…" for minutes

A letter is read by a Netlify background function, `read-letter`, round after round (`src/server/background/AGENTS.md`). A normal letter takes under a minute.

- Look at the function's log: Netlify, the project, Logs, Functions, `read-letter`, or `netlify logs --source functions --function read-letter`. Lines starting `[uploads]` or `[background]` say what went wrong.
- Open Home on any device signed in as that person. While a letter is being read, Home hands it to a reader again, and closes a round that has been running longer than `ROUND_DEADLINE_SECONDS` (about five and a half minutes) as one that decided nothing.
- The letter's rows in `extraction_runs` and `model_calls` say which round it is on and what each call answered.
- The **read-a-letter** job of the last run on main uploads a letter the same way and waits for it. If it is red too, the problem is the deploy, not the letter.

### Margaret's account looks wrong

Press **Refresh Margaret**. If her letters themselves should be different, change [`db/demo/margaret.json`](../db/demo/margaret.json) in a pull request (Jason reviews it), merge, then press the button.

### The data on the deployed database is lost or ruined

The free Supabase plan keeps no backups. Everything there is synthetic and comes from the repository, so the database is rebuilt rather than restored: [`deployment.md`, "Building the schema on Supabase" and "Loading the seed on Supabase"](deployment.md#building-the-schema-on-supabase). Those scripts empty every table, so the second guard stops them once somebody has registered with a real address, and that is deliberate: by then the data is someone's and not ours to rebuild. Before anything real is stored there, this needs a backup plan, which the Pro plan's daily backups or a scheduled `supabase db dump` would provide.

## Keys

Which value lives where (GitHub, Netlify, the keys file in Teams) is in [`deployment.md`, "Where the keys are"](deployment.md#where-the-keys-are). A key that changes in one place changes in every place listed there, or the next merge or the next press of a button stops at the step that uses it.
