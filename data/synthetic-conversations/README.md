# Synthetic conversations

Fictional conversations used to develop and test Module 3 without using a real
person's voice or personal information.

Each scenario contains three aligned files:

- `script.md`: the conversation a person can read or later record;
- `transcript.json`: the same words as structured transcript utterances; and
- `expected-commitments.json`: the commitments supported by those utterances.

These are curated ground-truth examples, not application storage. The voice
prototype reads them as fixtures and never writes user data here.

The `unclear-agreement` example checks the difference between a clear action
and a request that the other speaker has not accepted. Its `uncertain` status
describes the transcript evidence; it is not user approval.
