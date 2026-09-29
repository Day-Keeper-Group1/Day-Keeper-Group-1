# Module 3: Voice and Conversation Intelligence

**Status:** proposed Milestone 1 plan for team review.

The official project description defines Module 3 as consent-based call
transcription and extraction of commitments and follow-ups. Module 3 remains
outside the current release in [`scope.md`](scope.md). Milestone 1 does not
change that boundary or modify the existing document, task, reminder or database
systems. Later milestones are expected to add conversation tables and connect
reviewed commitments to the existing tasks, reminders and calendar.

This plan separates what the person uses, how the prototype processes data, and
the contracts that join those parts.

## Layer 1: Product prototype

### Goal

Build a working transcript-to-commitment prototype:

```text
Select audio
→ show a prepared transcript
→ extract commitments with Azure
→ review commitments and their evidence
```

The selected audio is not uploaded or transcribed in this milestone. A prepared
JSON fixture supplies the transcript. Nothing is saved and no task or reminder
is created.

### User flow

1. A signed-in user opens `/conversations/new`.
2. They select one audio file.
3. DayKeeper checks its format, size and duration.
4. They can play the selected file locally to confirm it is the right one.
5. DayKeeper shows a prepared transcript fixture.
6. The user starts commitment extraction.
7. DayKeeper shows each proposed commitment beside its supporting transcript
   lines.

The page covers file selection, transcript, extracting, results and failure
states. A saved-conversations list is not needed yet.

### Included

- One MP3, M4A, WAV or WebM audio file.
- Maximum file size of 50 MiB.
- Maximum duration of 30 minutes.
- Local browser playback without uploading the audio.
- A prepared transcript fixture with speaker labels and timestamps.
- Real commitment extraction through the existing RACE Azure API.
- A mock extraction provider for development without Azure credentials.
- Evidence highlighting in the transcript.
- Clear loading, empty, uncertain and failure states.
- Existing DayKeeper theme and accessibility rules.

### Not included

- Real transcription.
- Audio upload, object storage or database persistence.
- Task or reminder creation.
- A conversation archive.
- Live microphone or telephone-call recording.
- Editing the transcript or proposed commitments.
- Identifying which speaker is the signed-in user.
- Speaker recognition, translation, sentiment or emotion analysis.
- Real personal, health or financial conversations.

Development and demonstration use only fictional or synthetic recordings and
transcripts.

### Interface behaviour

- The selected audio can be played locally before extraction.
- Evidence indexes control which transcript lines are highlighted.
- Azure returns commitment data such as a title, date and evidence indexes.
  DayKeeper displays those values inside its own components; Azure cannot send
  page layout, links or executable markup.
- A missing date is shown neutrally as **No date found**.
- An uncertain proposal is shown as **Needs checking**, using warning colour,
  text and an icon. Colour is never its only signal.
- Uncertain proposals are excluded by default from any later task-creation
  flow.
- This milestone has no save or create-task action.

### Acceptance criteria

- **File selection:** A valid audio file can be selected and played locally.
- **File validation:** Unsupported types, files over 50 MiB and recordings over
  30 minutes are rejected with useful messages.
- **Transcript display:** The prepared transcript fixture is shown with speaker
  labels and timestamps.
- **Commitment display:** Valid extracted commitments are shown beside their
  supporting transcript lines.
- **Evidence:** Every displayed commitment highlights the correct transcript
  lines.
- **Result states:** No-commitment, missing-date and uncertain results are
  displayed correctly.
- **Azure failure:** A clear user-facing message is shown without exposing
  provider details.
- **Mock mode:** The prototype works without Azure credentials.
- **No persistence:** No audio, transcript or commitment is written to the
  database or filesystem.
- **Regression safety:** The existing DayKeeper test suite continues to pass.

## Layer 2: Processing flow

### One extraction

```text
Prepared transcript fixture
→ voice-specific commitment prompt
→ RACE Azure Responses API
→ runtime contract validation
→ commitments with transcript evidence
→ prototype interface
```

The browser does not call Azure directly. DayKeeper's server holds the
credentials, sends the transcript and prompt, validates the answer and returns
only contract-valid data. The mock follows the same flow boundary but returns a
fixed result without making an external call.

### Extraction rules

- A commitment is a promised or requested future action, not merely a topic,
  opinion or past event.
- The title begins with an action word and makes sense outside the conversation.
- No date or time is invented. Missing values are `null`.
- Every proposal cites at least one transcript utterance.
- The cited evidence must support the action and any returned date or time.
- Changed or cancelled plans must not be returned as active commitments.
- Unclear proposals use `status: "uncertain"`.
- The model returns data only. It never returns interface markup.

### Evidence and attribution

Each proposed commitment carries the indexes of the transcript utterances that
support it. The interface can therefore show the person exactly which words the
proposal came from, and the fixture tests can check whether the cited lines
actually support the title, date and time.

This follows the Attributable to Identified Sources evaluation framework, which
asks whether generated claims can be verified against an identified source
([Rashkin et al., 2023](https://aclanthology.org/2023.cl-4.2/)). Evidence makes
the model's answer traceable and easier to verify; it does not guarantee that
the answer is correct.

### Fixture scenarios

Fixtures are short fictional transcript examples stored as test data. Each one
is passed through the same extraction prompt to check a different situation.
Milestone 1 needs these core examples:

1. One clear commitment with a date.
2. Several commitments in one conversation.
3. No commitment.
4. A commitment without a date.
5. A changed or cancelled plan that must not become an active commitment.

An additional conflicting-date fixture can be added while refining the prompt
to check that the result is marked uncertain rather than guessed.

Each fixture includes a transcript and the commitments expected from it. Model
answers are compared with those expected results rather than judged only by
appearance.

Each scenario also keeps a human-readable script as its source material:

```text
data/synthetic-conversations/clear-commitment/
  script.md
  transcript.json
  expected-commitments.json
```

The script, transcript and expected commitments use the same wording. Later,
synthetic audio can be produced from that script for the real-transcription
milestone, keeping the audio, expected transcript and expected extraction
aligned.

### Model and prompt experiment

The starting experiment uses `gpt-5.6-luna` at medium reasoning through the
existing RACE Azure Responses API. It has its own commitment-extraction prompt;
the document-extraction prompt is not reused. The final model, effort and prompt
remain experimental choices until the fixture results support them.

The experiment records the exact model, effort, prompt, fixture results,
failures and response time so the selected configuration can be reproduced.

## Layer 3: Contracts and API boundary

### Transcript contract

The fixture and interface use ordered transcript utterances:

```ts
type TranscriptUtterance = {
  index: number;
  speaker: string; // for example, "Speaker 1"
  text: string;
  startMs: number;
  endMs: number;
};

type ConversationTranscript = {
  version: "1.0";
  utterances: TranscriptUtterance[];
};
```

### Commitment contract

The Azure and mock providers return the same shape:

```ts
type CommitmentProposal = {
  id: string;
  title: string;
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:mm in the user's timezone
  status: "confirmed" | "uncertain";
  evidence: number[]; // indexes into transcript.utterances
};

type CommitmentExtraction = {
  version: "1.0";
  commitments: CommitmentProposal[];
};
```

There is deliberately no `owner` field. Anonymous labels such as `Speaker 1`
do not reveal which speaker is the signed-in user. Ownership can be added later
through an explicit review step; it must not be guessed by a model.

An empty commitments array is a successful result. It means the conversation
contains no supported commitment.

### Provider and application boundary

- The interface supplies a validated `ConversationTranscript`.
- The server selects either the mock or Azure commitment provider.
- A provider receives the transcript and returns an untrusted result.
- The server validates that result as `CommitmentExtraction`.
- Only a validated result reaches the interface.
- Provider credentials and diagnostic failure details never reach the browser.

The exact HTTP request and response will be added to [`api.md`](api.md) before
an application route is implemented, following the repository's API-first
rule. Milestone 1 adds no persistence contract because it writes nothing to the
database or filesystem.

## Later milestones

These boundaries show where the prototype can grow. Their detailed designs are
not decisions of Milestone 1.

1. **Real transcription:** upload synthetic audio and normalize a transcription
   provider's speaker-separated response into `ConversationTranscript`.
2. **Persistence:** add approved conversation, transcript, consent and
   extraction tables plus private audio storage.
3. **Review and task creation:** allow reviewed commitments to create tasks and
   plan reminders through the existing Module 4 rules.
4. **Conversation archive:** list, open, play, archive and delete saved
   conversations.
5. **Live recording:** record two consenting nearby speakers through the browser
   microphone and feed the result into the same audio pipeline.
6. **Release verification:** complete provider evaluation, privacy review,
   accessibility verification and the reliable presentation path.

## Team review before implementation

The module owner leads the design and implementation. Before Milestone 1 starts,
the team reviews the decisions that affect shared product boundaries and
infrastructure:

- the Milestone 1 boundary;
- the file limits and formats;
- the transcript and commitment contracts;
- the absence of speaker ownership, persistence and task creation;
- the fixture scenarios and acceptance criteria;
- the proposed sequence and dependencies of later milestones.

After review, the module owner can implement three work packages: the contract
and fixtures, the `/conversations/new` interface with a mock provider, and the
Azure extraction experiment. They may be completed one at a time. All three
use the contracts in this document so the test data, model response and
interface stay aligned.

## Reference

Hannah Rashkin, Vitaly Nikolaev, Matthew Lamm, Lora Aroyo, Michael Collins,
Dipanjan Das, Slav Petrov, Gaurav Singh Tomar, Iulia Turc, and David Reitter.
2023. [Measuring Attribution in Natural Language Generation
Models](https://aclanthology.org/2023.cl-4.2/). *Computational Linguistics*,
49(4):777–840. DOI: 10.1162/coli_a_00486.
