---
name: daykeeper-jira
description: Work this project's Jira board (site day-keeper-group-1, project KAN, board 1). Find and read tickets, claim one, move it through To Do / In Progress / In Review / Done, comment, and handle sprint or backlog membership. Trigger on a KAN-NN issue key, or on any mention of the board, a sprint, the backlog, a ticket, or Jira.
---

# DayKeeper's Jira

Everything below is measured against this board rather than assumed from Jira in
general, because most of it is specific to a team-managed project on the free
plan and the general advice is often wrong here.

## The board, in facts

| | |
|---|---|
| Site | `https://day-keeper-group-1.atlassian.net` |
| Project | key `KAN`, id `10000`, team-managed (next-gen) software |
| Board | id `1` |
| Statuses | `To Do` → `In Progress` → `In Review` → `Done` |
| Plan | Free |

Everyone on the project, including the supervisor, is an administrator, so
anything written here is visible to all of them.

Issue type ids: Epic `10001`, Subtask `10002`, Task `10003`, Story `10004`,
Feature `10005`, Bug `10006`. The six share one set of statuses and very nearly
one set of fields, so choosing a type is a semantic label rather than a
different form.

Sprints are enabled and the project runs on them. Do not conclude otherwise
from the Agile API reporting `board type = simple`: that is what it says for
every team-managed project, and it is misleading. Ask
`jira_get_sprints_from_board(board_id=1, state="active")` for the current one
rather than assuming from a date.

**The Sprint field is optional on every issue type here.** So creating an issue
straight into the backlog works, and moving one back to the backlog works. (In
projects where Sprint is required, both are refused server-side with
`Sprint is required` and there is no way around it. Not an issue on this board,
but it is why the two operations sometimes fail elsewhere.)

## Doing things

Tools are `jira_*` on the Atlassian MCP server. Reading:

| to | use |
|---|---|
| search by JQL | `jira_search` with `jql`, `fields`, `limit` |
| read one ticket | `jira_get_issue` with `issue_key`, `comment_limit` |
| list sprints | `jira_get_sprints_from_board` with `board_id`, `state` |
| list a sprint's tickets | `jira_get_sprint_issues` |
| see what a status can move to | `jira_get_transitions` with `issue_key` |
| see what fields a type accepts | `jira_get_create_fields` with `project_key`, `issue_type_id` |
| find who can be assigned | `jira_search_assignable_users` |

Writing:

| to | use |
|---|---|
| create | `jira_create_issue` |
| edit | `jira_update_issue`, `fields` as a JSON string |
| claim it | `jira_update_issue` with `{"assignee":"someone@student.rmit.edu.au"}` |
| move it | `jira_get_transitions` first, then `jira_transition_issue` |
| comment | `jira_add_comment` |
| put in a sprint | `jira_add_issues_to_sprint` with `sprint_id`, `issue_keys` |
| send to backlog | `jira_move_issues_to_backlog` |
| link two tickets | `jira_create_issue_link` |
| log time | `jira_add_worklog` with `time_spent` like `"1h 30m"` |

Never hardcode an account id. People come and go; ask
`jira_search_assignable_users` each time.

"In the backlog" means "belongs to no sprint". It is not a status, so do not
read it off the board. `GET /rest/agile/1.0/board/1/backlog` is the answer, or
a ticket's `customfield_10020` being null. Note that Done tickets never appear
in the backlog view even when they have no sprint.

## What this team does with a ticket

- **Branch names start with the ticket key**, lowercased: `kan-13-photo-upload`.
  Jira attaches the branch and any pull request to that ticket automatically
  when the key is in the name, so the board stays wired to the code with
  nobody linking anything by hand.
- **Several tickets carry a comment pointing at their specification.** Read it
  before writing code; it names the section of `docs/api.md` that is the
  acceptance standard, and which types to import rather than restate.
- Claim a ticket by assigning it to yourself and moving it to In Progress, so
  two people do not start the same thing.

## Writing text that survives

The MCP server converts markdown through wiki markup into Atlassian's document
format, and that chain **loses content for real**, on the server, not just in
the response it echoes back. Nested bullets flatten, literal HTML-like tags
such as `<Toaster />` are stripped silently, and some ASCII characters vanish.

Plain text is fine: a one-line comment, a single paragraph, a flat list.

Anything with nested bullets, literal tags, mixed bold and code and links in one
paragraph, or headings mixed with lists, has to go through the REST API as a
document-format payload instead. See [`references/rich-text.md`](references/rich-text.md).

**Never trust a write tool's response as proof.** All of them mangle the
content on the way back. Read the ticket again from the server when it matters.

## Things that will mislead you

- `jira_search` sometimes reports `total` as `-1` on this project. Count the
  `issues` array instead.
- `jira_get_project_fields` returns `[]` for a project with no issues, which
  looks like "this project has no fields". Use `jira_get_create_fields` with an
  issue type id; it reads the create schema and answers correctly either way.
- Priority exists only on Task here, and Story points on everything except
  Epic. If a field seems missing it probably is: see
  [`references/fields.md`](references/fields.md).
- Priority has five levels, `Highest` through `Lowest`. There is no `Critical`.
- The issue key counter does not go backwards when a ticket is deleted, so a
  high number does not mean the project has that many tickets. Count with JQL.
- A 401 means the token belongs to a different Atlassian account, or has
  expired. Tokens are per account, not per person: one made while logged in
  with a personal account will never open this site.

## Connecting

The board needs a token that is yours. Sign in at
<https://id.atlassian.com/manage-profile/security/api-tokens> **with your RMIT
student account** (the page issues tokens for whichever account the browser is
logged into, which is the usual reason a token gets refused), create one, then
set three environment variables:

```
JIRA_URL=https://day-keeper-group-1.atlassian.net
JIRA_USERNAME=<your RMIT email>
JIRA_API_TOKEN=<the token>
```

The repository already carries the server definition in `.codex/config.toml`,
so there is nothing to configure beyond those three variables. Restart Codex
afterwards and check with `/mcp`.
