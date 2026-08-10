# Writing rich text into Jira without losing it

Read this when a description or comment needs nested bullets, literal
HTML-like tags, several marks in one paragraph, or headings mixed with lists.
For plain text the ordinary MCP tools are fine.

Atlassian stores rich text as ADF, a JSON document. The MCP server accepts
markdown and converts it, and that conversion drops content. So for anything
structured, send ADF to the REST API yourself.

## The envelope

Three shapes, and the difference between them is the usual first failure.

Comment, `POST /rest/api/3/issue/{KEY}/comment`:

```json
{ "body": { "type": "doc", "version": 1, "content": [ ... ] } }
```

Description, `PUT /rest/api/3/issue/{KEY}`, with no `body` wrapper:

```json
{ "fields": { "description": { "type": "doc", "version": 1, "content": [ ... ] } } }
```

Create, `POST /rest/api/3/issue`, same as the update, and `fields` can carry
`summary`, `duedate`, `labels`, `customfield_*` alongside. Status cannot be set
at creation; create first, then transition.

## Nodes

```json
{ "type": "paragraph", "content": [ { "type": "text", "text": "plain" } ] }

{ "type": "heading", "attrs": { "level": 2 },
  "content": [ { "type": "text", "text": "A heading" } ] }

{ "type": "bulletList", "content": [
  { "type": "listItem", "content": [
    { "type": "paragraph", "content": [ { "type": "text", "text": "top level" } ] },
    { "type": "bulletList", "content": [
      { "type": "listItem", "content": [
        { "type": "paragraph", "content": [ { "type": "text", "text": "nested" } ] } ] } ] } ] } ] }

{ "type": "codeBlock", "attrs": { "language": "typescript" },
  "content": [ { "type": "text", "text": "const x = 1;" } ] }

{ "type": "rule" }
```

A nested list lives **inside the parent's `listItem`**, after that item's
paragraph. That is the shape people get wrong, and it is also exactly what the
markdown conversion flattens.

Marks go on a text node: `{"type":"text","text":"bold","marks":[{"type":"strong"}]}`.
Available: `strong`, `em`, `code`, `strike`, `underline`, and
`{"type":"link","attrs":{"href":"https://..."}}`.

## Sending it

Two failures are hard to diagnose from the server's reply, so guard both.

**Validate the JSON locally first.** A syntax error comes back as
`There was an error parsing JSON. Check that your request body is valid.` with
no line number, and nested `listItem` brackets are easy to miscount.

**Read the error body on a 400.** The actual reason (which field, which value)
is in the response body, not the status line.

With curl:

```bash
python -m json.tool payload.json > /dev/null || echo "invalid JSON"

curl -sS -X POST \
  -u "$JIRA_USERNAME:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @payload.json \
  "$JIRA_URL/rest/api/3/issue/KAN-13/comment"
```

With PowerShell, three rules keep non-ASCII text intact: write the JSON with a
literal here-string `@'...'@` so `$` is not interpolated, save as UTF-8 without
a BOM, and send the bytes rather than the string.

```powershell
$adf = @'
{"body":{"type":"doc","version":1,"content":[ ... ]}}
'@
try { $null = $adf | ConvertFrom-Json } catch { "invalid JSON: $($_.Exception.Message)"; exit 1 }

$f = "$env:TEMP\adf.json"
[IO.File]::WriteAllText($f, $adf, [Text.UTF8Encoding]::new($false))
$pair = "$env:JIRA_USERNAME`:$env:JIRA_API_TOKEN"   # the backtick escapes the colon
$headers = @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair)) }
try {
  Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json; charset=utf-8" `
    -Body ([IO.File]::ReadAllBytes($f)) -Uri "$env:JIRA_URL/rest/api/3/issue/KAN-13/comment"
} catch {
  "STATUS: $($_.Exception.Response.StatusCode.value__)"
  $_.ErrorDetails.Message
}
```

Do not reach for `$_.Exception.Response.GetResponseStream()`. That is Windows
PowerShell 5.1; PowerShell 7 uses `HttpClient`, which has no such method, and
calling it throws an unrelated `Method invocation failed` that hides the real
error.

## Checking it landed

Read it back. The write response is not evidence.

```bash
curl -sS -u "$JIRA_USERNAME:$JIRA_API_TOKEN" \
  "$JIRA_URL/rest/api/3/issue/KAN-13?fields=description" | python -m json.tool
```

Matching top-level block types is not enough: nesting and marks can be eaten
while the outline survives. Look inside a `bulletList` for a second
`bulletList`, and inside text nodes for the `marks` you sent.

One false alarm to know about: Jira's `renderedFields` HTML renders some blocks
imperfectly (a `taskList` comes out as an ordinary `<ul>`). The stored document
is still correct; check the ADF, not the rendering.
