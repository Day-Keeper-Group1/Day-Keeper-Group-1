# Selected-email smoke experiment

A small development smoke check, not an accuracy benchmark. The photo extraction
prompt/model/efforts are unchanged. This experiment uses the separate email prompt
and the existing reader/judge scheme on synthetic bill, appointment and newsletter
messages. It checks the fields listed in fixtures.json and records every reading.

Run from the repository root with project Azure credentials configured:

```powershell
node --conditions=react-server --import tsx experiments/module-02-email/01-selected-email/probe.ts
```

Only these synthetic fixtures are sent. report.json records the model responses,
usage and field assertions; no credentials or private email are written. The unit
and database workflow tests separately check access, retries, deduplication and
confirmation. Broader evaluation of real-world email remains necessary.

## Result

The first run returned all six requested fields correctly for all three messages,
but omitted the appointment's optional due_time (kept in report-initial.json).
After specifying due_time as an entry in the fields array, the rerun passed all
three fixtures, including 10:30 for the appointment. report.json records that run.
The prompt hash is stored with each report. This sample is too small to support
an accuracy estimate.
