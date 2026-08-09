# ADR 002: Our own users table and database sessions, behind one function

Status: accepted, 9 August 2026
Decision by: Jason (technical lead)

## Context

The tech stack note and the roadmap both recommend Supabase Auth with row level
security. That is a reasonable recommendation and it may still be where we end
up. But adopting it now has costs that land immediately:

- Somebody has to own a Supabase project and hand out credentials. Until that
  happens nobody can run the application, and the project bans shared and
  personally-paid cloud accounts.
- The deployment owner has not confirmed where this is hosted. The risk register
  records that hosting may not satisfy RMIT or client constraints.
- Supabase Auth puts users in its own `auth.users` schema. Every table that
  references a person then points at it, and moving away later means rewriting
  the schema, not swapping a library.

Meanwhile, teammates need to be able to write features on Monday.

## Decision

A `users` table of our own, passwords hashed with scrypt from Node's crypto
module, and sessions as rows in a `sessions` table keyed by the SHA-256 of a
random token held in an httpOnly cookie.

Every caller must reach authentication through exactly one function,
`getCurrentUser()`, to live at `src/server/auth/session.ts`. Nothing else in the
application may know how someone is authenticated. This branch ships the schema
and the password hashing; the session handling is to be built against that rule.

## Why

The single function is the actual decision. It means the choice above is
reversible: adopting Supabase Auth later replaces one file, and the other
seventy do not change. Adopting it now would be irreversible in the direction
that matters, because our tables would be built on its schema.

The specifics:

- **scrypt over bcrypt or argon2.** It is memory-hard, it is in Node's standard
  library, and it needs no native build step that would fail on somebody's
  Windows laptop during their first `npm ci`.
- **Sessions in the database, not signed tokens.** Signing out, deactivating an
  account, or a lost laptop can all end a session immediately. A self-contained
  signed token stays valid until it expires no matter what we do.
- **The cookie holds a token, the database holds its hash.** A database leak
  does not hand over live sessions.

## What this is not

This is not a claim that hand-rolled authentication is better than a managed
provider. For anything with real users it is not. It is a claim that for a
prototype with synthetic data, a hundred lines we control beats a dependency we
cannot provision this week, given that the interface between them is one
function either way.

## Roles

Four exist in the schema: `user`, `platform_operator`, `org_admin`,
`org_worker`. Only the first two are implemented; the organisation roles are
named because the project description anticipates them and adding an enum value
later is not free.

The operator role deliberately grants no access to letter content. The admin
dashboard shows accounts and system health, and the audit table has nowhere to
put the contents of a letter. That is the promise the prototype makes on screen,
and the schema is built so it cannot quietly be broken.

## Consequences

- Password reset is not implemented. The page exists and does nothing, which is
  honest about the state of it. It needs an email sender, which we do not have.
- No rate limiting on sign-in yet. Worth a ticket before anything is public.
- Row level security is not used. Ownership is enforced in the queries, every
  one of which is scoped by user id, and there is a test that proves one
  person's document is invisible to another.
