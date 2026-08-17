# ADR 005: An upload is a batch, and the reader decides where the letters divide

Status: accepted, 17 August 2026
Decision by: Jason (technical lead)

## Context

`POST /api/documents` took a set of photographs and made one document out of
them. That is not a rule anyone wrote down; it is an assumption that got built
into the shape of an endpoint, and the product prototype shares it, because its
sketch posts one letter at a time.

Real input is not like that. A person clearing a week of post photographs
whatever is in front of them. Ten photographs might be three pages of a rates
notice, four pages of a claim form, and then three more that belong to a letter
they uploaded last week and only just found the rest of. Nothing about the act
of photographing tells us where one letter ends and the next begins, and asking
the person to tell us is asking them to do the sorting this product exists to
do for them.

So the question the system has to answer before it can answer anything else is:
**how many letters are in this pile, and which pages belong to which?**

## Decision

### An upload is a batch. It may produce any number of documents.

`POST /api/documents` accepts up to `MAX_PAGES` photographs as one batch and
answers with the batch, not with a document. The documents appear as the
reading works out how many there are.

Ten remains the limit. It is not a claim about how many pages a model can
segment correctly; it is a bound on how much there is to untangle when the
model gets it wrong.

### The pass that looks at the pictures is the pass that divides them.

The reader returns, per page, the text it read **and** whether that page starts
a new letter or continues the previous one. Deterministic code walks those
answers and assembles the groups.

Two things this rules out, both of which look reasonable and are not:

- **Segmenting with a second model, over the text.** The strongest evidence for
  a page boundary is visual: a letterhead at the top of the page, the same logo
  as the sheet before it, a different layout. Most of that does not survive
  being flattened into text. The reader is the only component that ever sees
  the images, so asking it for the text and then paying a second model to
  reconstruct what the first one could see is discarding evidence and then
  buying a guess.
- **Grouping by document type.** Type answers "what kind of letter is this".
  Grouping answers "which physical letter is this page part of". A batch can
  hold two bills, and a type classifier merges them into one document whose
  fields are drawn from two letters. That failure produces a plausible-looking
  result, which makes it worse than a loud one.

Type keeps its proper place: it is `document_type`, one of the six fields,
extracted per letter after the letters exist.

### There is no screen that asks a person to confirm the grouping.

This is the decision the rest of the product hangs off, so it is worth being
plain about why, because "ask the user to check it" is the reflex.

A grouping mistake does not hide. If two letters are merged, the person sees
one letter whose fields contradict each other. If one letter is split, they see
two, one of which has half its fields unreadable. **Both errors surface on the
review screen, which the person is already looking at.** A confirmation step
before it would therefore catch nothing that is not caught anyway, and would
charge a person who is overwhelmed by paperwork one more decision about a
question they did not know they had. Handing the sorting back is the failure
this product is for.

The corollary is that the grouping is invisible. She is never told that pages
one to three became one letter. She is told there is an electricity bill for
$347.60 due on the fifteenth, and asked whether that is right.

### The confirmation card asks one question, and it is asked only when the
answer changes.

The question is **what to do, and when**. Everything else on the screen is
there to let her answer it.

That makes the rule for interrupting her simple. When new pages arrive for a
letter she has already confirmed, the reader re-reads the letter and the system
compares the new answer to the stored one on four fields: `action_required`,
`due_date`, `due_time`, `amount`. If any of them changed, the letter goes back
to `needs-review` and she is asked again. If none did, the letter is updated
silently and she is not told.

The comparison is code, not a judgement. Whether these pages belong to that
letter, and what they say, are the model's answers; whether that changes what
she has to do is `!=` on four values. Keeping it that way means the rule can be
demonstrated and tested, rather than being a second probabilistic surface with
no ground truth.

`amount` is in the list. She still has to "pay the AGL bill on the fifteenth"
whether it is $347 or $412, so it is not literally part of "what and when", but
paying the wrong number is a harm she carries.

### The promise on screen gets stronger, not weaker.

The review screen currently promises that nothing happens until she says so.
Under this decision it can promise something better and more checkable:

> **You will be asked whenever what you have to do changes, and never
> otherwise.**

That sentence covers the silent update rather than leaving it outside the
promise, and it is the same rule that already governs the batched notification
("One message, not one per letter"). Three behaviours, one principle: spend her
attention only on changes to what she must do.

### Letters appear one at a time. Notifications do not.

Each letter in a batch is read and matched independently, so a batch of three
produces three rows that turn from "reading" to "ready to check" whenever each
one finishes. That is the queue the prototype already draws.

The notification is batched anyway. Three independent workers each sending a
message is three messages, and the screen promises one.

## The bet, stated so it can be lost

This design is staked on one number: **how often the reader divides a batch
wrongly.** No confirmation screen means no human check on that step, so if the
miss rate is bad, this decision has to be revisited rather than defended.

It is cheap to measure and it does not need a real letter. Batches of known
composition can be assembled and the reader's grouping compared to the truth,
which is a binary judgement per page. That measurement should happen early,
because it validates or kills the design and everything downstream assumes it
holds.

## Consequences

- Pages arrive before anyone knows which document they belong to, so
  `document_pages.document_id` can no longer be assigned at the moment of
  upload. Pages belong to a batch first (see `db/schema.sql`).
- The interface has a state it did not have: a batch that has been posted and
  not yet divided. One row becomes several. What that looks like is a product
  question and is not settled here.
- A document can now gain pages after it was confirmed. Those pages are a new
  attempt on the existing document, not an edit of it: the previous reading
  stays, as ADR 003 requires of every reading.
- Every silent update is recorded. It is the one class of decision this system
  makes on a person's behalf that is invisible by construction, so if it is
  ever wrong, nothing else will surface it.
