# DayKeeper (G1)

An AI-powered life management system for people in vulnerable groups: you
photograph a letter, the system reads it, and it becomes tasks and reminders.
RMIT COSC2648 capstone project, P000473SE, Group 1.

**New here? Start at "Getting it running" and do it in order.** It takes about
ten minutes, most of which is waiting for downloads, and you need no account,
no API key and no permission from anybody.

## Getting it running

You need [Node](https://nodejs.org) 22.13 or newer and
[Docker Desktop](https://www.docker.com/products/docker-desktop/). Install them
first if you have not; Docker needs to be running, not just installed.

```bash
git lfs install           # once per machine: the letter images are in Git LFS
git clone git@github.com:Day-Keeper-Group1/Day-Keeper-Group-1.git
cd Day-Keeper-Group-1

npm ci                    # installs exactly what the lockfile says
cp .env.example .env.local
docker compose up -d      # Postgres on 15432, a database viewer on 8080
docker compose ps         # wait until db says "healthy", a few seconds
npm run db:reset          # build the database and plant the demonstration seed
npm run dev
```

Open <http://localhost:3000/dashboard>.

Sign in as `margaret@example.com`, password `daykeeper`. **You should see** a warm
cream dashboard that says there is nothing to check, three tasks due in the
next seven days and two already ticked off. If you do, everything works and you
are ready to pick up a ticket.

If instead you see an error, it is almost always one of three things, and none
of them is a bug in the code: Docker is not running, `npm ci` has not finished,
or `.env.local` was never created. `docs/start-here.md` has the full list.

Two more things worth doing once:

```bash
npm test                  # about half a second, should be all green
```

and open [`docs/prototype/user/daykeeper-sketch-live.html`](docs/prototype/user/daykeeper-sketch-live.html)
in a browser. That is the clickable prototype of the product we are building.
Click through it; it is the fastest way to understand what the tickets are for.

## Working on it with AI

This repository is set up so that an AI coding tool understands it on its own.
`AGENTS.md` in the root is loaded automatically by Codex and by most other
tools, and it points at everything else: the API specification, the theme, the
database, the conventions. You do not have to explain the project to your AI.

If you have never done this before, the whole procedure is:

1. Install [Codex](https://developers.openai.com/codex) (the team's default) or
   whichever AI coding tool you prefer.
2. Open it **in this folder**. That part matters: the tool reads the project's
   instructions from the folder it is started in.
3. Type a first message. Something like:

   > Read AGENTS.md and docs/start-here.md, then tell me in your own words what
   > this project is and what is already built.

You will see it start opening files by itself for a minute or two. That is
normal and it is the point; let it finish. When it answers, you will both be
looking at the same project.

When you are ready to build something, give it the ticket:

   > I am picking up KAN-13. Read the ticket's comment for which spec section
   > applies, then plan the work with me before writing any code.

## Picking up a ticket

The board is on
[Jira](https://day-keeper-group-1.atlassian.net/jira/software/projects/KAN/boards/1).
Take one, assign it to yourself, and move it to In Progress so nobody doubles
up.

Several tickets carry a comment that points at the exact section of
[`docs/api.md`](docs/api.md) that defines what "done" means for them, and at
the TypeScript types to import rather than rewrite. Read that comment first;
it is the difference between building the right shape and building it twice.

Name your branch with the ticket key at the front, lowercased:

```bash
git checkout -b kan-13-photo-upload
```

Jira attaches the branch and your pull request to that ticket automatically
when the key is in the name, so the board stays connected to the code without
anyone linking anything by hand.

Then work, commit, push, and open a pull request. Formatting and linting run
automatically when you commit, so do not spend time on either.

## What is here

Four things to open, in this order:

- [`docs/scope.md`](docs/scope.md): what this release builds and what it does
  not. Read it first. If any other document disagrees with it, that document is
  the one that is wrong.
- [`docs/start-here.md`](docs/start-here.md): setup in more depth, what the
  example data contains, and the shape of the codebase.
- [`docs/prototype/user/daykeeper-sketch-live.html`](docs/prototype/user/daykeeper-sketch-live.html):
  clickable prototype of the user flow. Open it in a browser to see what a
  screen is supposed to look like.
- [`AGENTS.md`](AGENTS.md): the full index of the repository, the conventions,
  and the reasons behind the shape it has. Everything else is listed there, so
  it is listed there once rather than in two places that drift apart.

## Optional: let your AI use Jira directly

Not needed for anything above, and worth setting up only once you have the
project running. It lets you say "pick up KAN-13" instead of pasting the ticket
in yourself, and lets the AI move tickets and comment on them for you.

1. Create an API token at
   <https://id.atlassian.com/manage-profile/security/api-tokens>, **signed in
   with your RMIT student account**. The page issues tokens for whichever
   account the browser is logged into, which is the usual reason one gets
   refused later.
2. Set three environment variables on your machine:
   `JIRA_URL=https://day-keeper-group-1.atlassian.net`,
   `JIRA_USERNAME=<your RMIT email>`, `JIRA_API_TOKEN=<the token>`.
3. Restart Codex. The server itself is already configured in
   [`.codex/config.toml`](.codex/config.toml), which carries no secret; check
   it connected with `/mcp`.

The `$daykeeper-jira` skill in [`.agents/skills/`](.agents/skills/) then tells
your AI how this board actually works: the statuses, the issue types, which
fields exist, and the several ways Jira misleads you about this kind of
project. Ask it to read that skill if it does not pick it up on its own.

## Team

Gerry Lu (Scrum Master) · Xiaocong "XC" Su · Hiruni Perera · Zhenying "Sai" Cui · Junchun "Jason" Zhang

Client: Prof. Mohammad Patwary · Supervisor: Dr. Golnoush Abaei
