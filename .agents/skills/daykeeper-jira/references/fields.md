# Why a field is missing, and how it gets added

Read this when a field you expected is not there: no Priority on a Story, no
Story points anywhere, "this project has no fields".

A team-managed project starts with **no Priority and no Story points at all**.
They are not hidden by permissions or by the free plan; they do not exist in
the project until somebody turns them on. Both are available on the free plan,
so a lock icon or an upgrade prompt means something else is wrong.

## Where this board stands

Turned on 2 August 2026, and worth re-checking because any of the six
administrators can change it:

| | Priority | Story point estimate |
|---|---|---|
| Task | yes | yes |
| Story, Bug, Feature, Subtask | no | yes |
| Epic | no | no |

So a Story cannot carry a priority here today. That is a configuration gap
rather than a rule.

Components and Fix Version exist at site level but are not enabled on this
project.

## The two are turned on in completely different ways

**Story points: one switch, project-wide.** `Space settings → Features →
Estimation`. It creates `customfield_10016` and adds it to every issue type
except Epic, in one action. Epic not getting it is Jira's design, not a miss.

**Priority: one issue type at a time.** `Space settings → Work types → {type} →
Fields → System fields → Priority`. Two traps: the field lands in
*Description fields* rather than *Context fields* where it belongs, so use the
row's `...` menu and `Move to section → Context fields`; and there is no
project-wide switch, so six types means doing it six times. Half-doing it is
what produced the table above.

**Neither has a public REST API.** Team-managed field configuration is UI only:
the MCP server does not cover it, `acli jira field` is for company-managed
global fields, and the endpoints that exist are internal and unstable. Drive a
browser, or ask a human to click it. Do not go looking for an API that is not
there.

## Confirming what actually happened

The UI's save confirmation is not proof. Ask the server:

```
jira_get_create_fields(project_key="KAN", issue_type_id="10004")
```

and look for `priority` and `customfield_10016` in the result.

## Writing the two fields

| field | in a REST create |
|---|---|
| Priority | `"priority": {"name": "Highest"}`, five levels `Highest` to `Lowest`, no `Critical` |
| Story points | `"customfield_10016": 5`, a free number, not a dropdown |
| Sprint | `"customfield_10020": 1`, a bare sprint id, not an array or an object |
