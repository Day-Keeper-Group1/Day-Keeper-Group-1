# 02: Spoken times (KAN-149)

Question: when a recorded conversation says a time aloud, such as "at 10 in the
morning", does the voice reader return it as `dueTime` every time?

## Why

The demonstration recording `data/synthetic-conversations/dental-callback/recording.wav`
says the check-up is "on Thursday, the twelfth of November, two thousand and
twenty-six, at ten in the morning", and Margaret promises to bring her Medicare
card to it. On the deployed site the Medicare commitment came back as
2026-11-12 at 10:00 from the upload at 17:23 UTC on 17 October, and as
2026-11-12 with no time from the upload at 15:13 UTC on 18 October (02:13 on
19 October in Melbourne). The two stored transcripts are byte for byte the
same, so the browser's transcription did not change: the same input gave two
answers.
The prompt's only word on time was "an explicitly supported time in 24-hour
`HH:mm` format, or `null`. Never invent or guess a time."

## Method

- Transcript: [`dental-callback-transcript.json`](dental-callback-transcript.json),
  copied from the deployed database (Margaret's two voice conversations of 17
  and 18 October UTC; a `jsonb` comparison confirmed both equal it). It is what
  the browser's Whisper model wrote, not `script.md`: "checkup", "12th of
  November, 2026", "at 10 in the morning". Keep it that way; the digits are
  part of what is being tested.
- Reader: the server's own path. [`probe.ts`](probe.ts) calls
  `AzureCommitmentExtractionProvider.extract()` and then
  `validateCommitmentOutcome()`, the two calls `extractSavedVoice` in
  `src/server/voice/records.ts` makes, with the default `VOICE_READER`:
  `gpt-5.6-luna`, reasoning effort `medium`. The protected
  `/api/conversations/extract` route used by experiment 01 accepts only the six
  scenario IDs, so it could not take this transcript.
- Prompt: `src/server/voice/prompt.md`, sent with LF line endings exactly as the
  deployed site sends it. Before: SHA-256
  `b3623cf270318ce98cb447fa437d7aa9078ed2a8078ce23edf16ac3ee89a3770`, the
  prompt of tag `v1.0.0`. After:
  `070161dcf46c6087d1e7a32f8cfabed6d860c1778999e2fec77518038dfc94d3`.
- Runs: ten reads of the dental transcript with each prompt, then one read of
  each of the six scored Milestone 1 fixtures with the new prompt. Sequential,
  no retries. Run on 19 October 2026 (Melbourne).
- Calls: 26 in total (10 + 10 + 6), counted by the `audit_logs` rows
  `spendSchoolKey("voice")` wrote in the worktree's own database: 0 before the
  first run, 26 after the last. No call failed.
- Ship rule, set before the after-runs: keep the change only if the Medicare
  time is 10:00 in at least 9 of 10 runs and all six fixtures still meet their
  expected commitments (the 7 October pass rule: same number of commitments,
  same date, time and status, citing at least the expected lines; titles may
  differ in wording). A proposal that is not `clear` never reaches the user, so
  the status is counted too.

## The change

One addition to the `dueTime` line of the prompt:

```diff
-- `dueTime`: an explicitly supported time in 24-hour `HH:mm` format, or `null`. Never invent or guess a time.
+- `dueTime`: an explicitly supported time in 24-hour `HH:mm` format, or `null`. Never invent or guess a time. A time spoken in words or digits is explicit when it says morning or afternoon, or the conversation settles which: "nine in the morning" and "9 in the morning" are `09:00`, "half past two in the afternoon" is `14:30`, "quarter to four in the afternoon" is `15:45`. A time already written as a clock time, such as 10:30, keeps that value. An hour with no such cue, such as "at two", stays `null`.
```

The examples deliberately avoid the dental line's own words.

## Results

| Run | Before: Medicare | Before: callback time | After: Medicare | After: callback time |
|---|---|---|---|---|
| 1 | 2026-11-12 **10:00** clear [1,5,6] | null | 2026-11-12 **10:00** clear [1,5,6] | null |
| 2 | 2026-11-12 **null** clear [1,5,6] | null | 2026-11-12 **10:00** clear [1,5,6] | null |
| 3 | 2026-11-12 **null** clear [1,5,6] | null | 2026-11-12 **10:00** clear [1,5,6] | null |
| 4 | 2026-11-12 **10:00** clear [1,5,6] | null | 2026-11-12 **10:00** clear [1,6] | null |
| 5 | 2026-11-12 **10:00** clear [1,5,6] | null | 2026-11-12 **10:00** clear [1,5,6] | null |
| 6 | 2026-11-12 **null** clear [1,5,6] | null | 2026-11-12 **10:00** clear [1,5,6] | null |
| 7 | 2026-11-12 **10:00** clear [1,5,6] | null | 2026-11-12 **10:00** clear [1,5,6] | null |
| 8 | 2026-11-12 **null** clear [1,5,6] | null | 2026-11-12 **10:00** clear [1,5,6] | null |
| 9 | 2026-11-12 **10:00** clear [1,5,6] | null | 2026-11-12 **10:00** clear [1,6] | null |
| 10 | 2026-11-12 **10:00** clear [1,5,6] | null | 2026-11-12 **10:00** clear [1,5,6] | null |
| **Total** | **6/10 at 10:00** | 0/10 with a time | **10/10 at 10:00** | 0/10 with a time |

Every run returned exactly two commitments, both `clear`: bring the Medicare
card (2026-11-12) and call Bayside Dental back (2026-11-06, no time). The square
brackets are the cited transcript lines. Twice after the change the Medicare
proposal cited [1,6] rather than [1,5,6]: line 6 ("I will bring my Medicare card
to the check-up") already carries the whole action, so this is not a defect.
Once before the change the callback cited [0,3] instead of [2,3]. Raw answers,
token usage and timings: [`results-before.json`](results-before.json) and
[`results-after.json`](results-after.json).

Six fixtures with the new prompt, one read each: **6/6 met their expected
commitments** (several, clear, missing date, none, cancelled, unclear). The
titles were read by hand in [`results-fixtures.json`](results-fixtures.json);
the clear-commitment fixture still returns 10:30, and no fixture gained a time.

## Conclusion

The ship rule is met: 10/10 against a threshold of 9/10, and 6/6 fixtures. The
prompt change is kept. Before it, the same transcript lost its time in 4 of 10
reads, which matches what the deployed site showed.

This is a small functional check on one recorded conversation and six short
fixtures, not an accuracy estimate. It does not test a time with no morning or
afternoon cue, a time stated by the other speaker and changed later, or
afternoon times in real speech; those would need their own fixtures.
