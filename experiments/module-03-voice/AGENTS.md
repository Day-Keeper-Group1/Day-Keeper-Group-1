# Voice experiment

Use only the fictional transcripts in `data/synthetic-conversations/`. Run the
protected `/api/conversations/extract` endpoint with the team-issued RACE key;
the route records every call through `spendSchoolKey`. Do not put credentials,
session cookies, real conversations or recordings in this directory. Keep raw
answers alongside the prompt hash and model settings so a later prompt change
can be evaluated against the same fixtures.
