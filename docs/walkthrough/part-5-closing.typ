#import "lib.typ": *

#part("What is not settled")

These are open questions rather than oversights. Each one needs a decision
nobody has made, and guessing at it now would mean building the wrong thing
twice. They are grouped by how soon a person meets them.

== The four a person meets first

#tbl(
  columns: (auto, 1fr),
  [*One row becoming several*], [A pile is one row while it is being divided and then it is three letters. Whether the row splits in place, fades and is replaced, or the letters slide in underneath, is a piece of motion nobody has designed, and it is the first thing she sees after pressing the button.],
  [*Holding the camera open*], [The capture screen says the camera stays open and shots accumulate. A plain file input cannot do that: on both iOS and Android it closes the camera and returns to the page after every single shot. A live stream captured to blobs can. Whichever is chosen has to be said on the screen as well as in the code.],
  [*Which page was the bad one*], [A five-page letter that fails says only that the photograph was too blurry. Which one? A page number on the failure would let it say "page three", and she would photograph one sheet instead of five.],
  [*The limits, seen from the camera*], [Ten photographs, ten megabytes each, and a current phone clears that per frame routinely. Whether the client scales a photograph down to fit or refuses it, and what the screen says at the tenth, is undecided. Refusing quietly loses a photograph she deliberately took, which is the failure the limits exist to prevent.],
)

== The machinery behind the screens

#tbl(
  columns: (auto, 1fr),
  [*What runs a reading*], [The upload answers before the reading happens, so something has to perform it: in the same process after responding, a sweep over an index of queued runs, or a real queue. The schema supports all three.],
  [*What wakes the clock*], [What the dispatcher decides is settled: at a reminder's moment it reads the task, sends if it is open, writes `skipped` if it is done. What wakes it up is not. A cron job, a platform scheduler, or in-app only.],
  [*The "your letters are ready" message*], [The prototype promises one batched message when readings finish. It is not modelled yet: reminders belong to tasks, and these documents have no task. It needs a table of its own, which arrives with the decision about batching window, channel and quiet hours.],
  [*A blur check at capture time*], [Catching a bad photograph while she is still holding the letter would be worth a great deal. It needs a second provider method and a model that can actually do it, and it arrives with that model or not at all.],
)

== Around the edges

Password reset needs an email sender. The admin endpoints need the operator's
permissions settled first, and the promise on screen is that letter content is
never visible there, which the audit table is built to make impossible rather
than merely forbidden. A settings screen would expose the timezone the schema
already stores. Sign-in has no rate limiting, which matters before anything is
public. And the greeting says "Good morning, Margaret" using a display name
that holds "Margaret Whitfield", so a preferred name arrives whenever somebody
decides what this product calls her.

== Two numbers this design is staked on#anchor(<bets>)

Everything else on this page is a decision waiting to be made. These two are
measurements waiting to be taken, and they are different in kind: the design
above is *betting* on them, and if either comes back badly the right response
is to revisit a decision rather than defend it.

#tbl(
  columns: (auto, 1fr),
  [*How often the dividing is wrong*], [No screen confirms the grouping, so this number is the whole safety case for step 2. It has three parts and they are not equally dangerous. A merge shows itself as one letter whose fields contradict each other, a split as two letters with half their fields missing, and both land on the review screen she is already reading. *A real letter judged to be no letter lands nowhere*, and nothing downstream can notice what was never created. That is the part that matters most, precisely because it is the only one with no second pair of eyes anywhere behind it.],
  [*How often the matcher fails to find a letter that was there*], [This decides whether the search stays literal or has to climb: trigram matching first, embeddings after that. Both rungs are designed and neither is built, because the number that would justify one does not exist yet.],
)

Neither measurement needs a real letter or a real person. Batches of known
composition can be assembled from synthetic documents and the reading's answer
compared against the truth, which is a binary judgement per photograph. The
same holds for the matcher: hide a page from a letter that is already in the
archive, hand it back as a new upload, and see whether it comes home. The
ground truth is known by construction, which is what makes these numbers
reportable rather than anecdotal.

#part("Where to start reading")

Every one of these is a real file in the repository. The point of this table is
that you should not have to read the other eight to change one thing.

#tbl(
  columns: (auto, 1fr),
  [*If you want to*], [*Read this first*],
  [Run the whole thing on your machine], [`docs/start-here.md`: what to install, what the seed contains, and where everything lives],
  [See what a screen is supposed to look like], [`docs/prototype/user/daykeeper-sketch-live.html`, which is the UX authority. Where it and a document disagree, it wins],
  [Build an endpoint], [`docs/api.md` for the shape, `src/lib/contract/` for the types. Import the types rather than restating them],
  [Change the database], [`db/schema.sql`, which is the only definition there is, then `npm run db:reset`],
  [Style anything], [`docs/theme.md` before touching a colour. It has the palette, the measured contrast of every pair, and why each rule exists],
  [Understand why something is odd], [`docs/architecture/`, the eight decisions listed on page #pageof(<adrs>)],
  [Connect a real model], [`src/server/extraction/`, behind one provider interface, with the mock as the worked example],
  [Touch a photograph], [`src/server/storage.ts`, which is the only place in the application allowed to read or write bytes],
)

#v(6pt)

The repository holds the schema, the contract and its validators, a mock reader
that misbehaves on purpose, the prototype, the theme with tests that fail when
a colour drifts, and the eight decisions. The endpoints in `docs/api.md`
describe the shape they are to be built in. That specification exists first on
purpose: the interface, the reader and the database are being written by
different people, and the only way that ends in something that fits together is
to settle the seams before the parts.
