# DayKeeper, Group 1 — class presentation, 24 September

## Slide 1 · DayKeeper · 0:20 (0:20) · Gerry

Good afternoon. We are Group 1, and this is DayKeeper.
Our client is Professor Mohammad Patwary.
Our supervisor is Dr Golnoush Abaei.

## Slide 2 · One place for everything life sends you · 0:30 (0:50) · Gerry

Life sends you letters, emails and phone calls, and every one of them wants something.
For people in vulnerable groups, one missed deadline is a fine, and a pile of them is the end of living independently.
DayKeeper captures them all, understands what each one asks, and keeps it in one place.
This semester, we started with the letters.

## Slide 3 · One letter, five things to read · 0:25 (1:15) · Gerry

This is a real letter: an electricity bill.
It is a visually rich document: boxes, columns, a payment panel.
From it we want five things: who sent it, how much, what to do, when it's due, and the number to quote.
Let's see DayKeeper read it.

## Slide 4 · Demo video · 1:14 (2:29) · video

Nothing to say here. The video carries its own narration, one minute fourteen.

## Slide 5 · The Theme · 0:19 (2:48) · Jason

We build for people in vulnerable groups, so the interface has to be simple.
But simple is not a guess. Our theme has medical evidence behind it, and every decision on this screen has a reference.

## Slide 6 · The stack · 0:22 (3:10) · Jason

The simpler the front end, the more the back end has to carry.
This is our stack.
Most of the weight sits on the LLM, and that is where the risk is. So the rest of this talk is about AI engineering.

## Slide 7 · We built the dataset first · 0:35 (3:45) · Jason

How do we know the LLM read it right? You cannot ask the model.
In AI engineering you cannot get far without evals. An eval is test driven development for a model: you write the test before you change anything.
Step one is the dataset. Ours is twenty-six synthetic letters, each built from real regulation, with the sources written down. Fifteen are in this release.

## Slide 8 · Every letter has an answer key · 0:30 (4:15) · Jason

Every letter has an answer key: the same six fields, written by hand and checked against the page.
When the LLM reads the letter, code compares its JSON with the key, field by field.
No person marks it.
So the test is exact, and it runs in bulk: hundreds of reads in one night.

## Slide 9 · An experiment may change five things · 0:20 (4:35) · Jason

Every experiment may change only five things: the letters, the model, the prompt, the number of repeats, and the scheme, which is how the reads are combined.
Seven experiments so far.
The breakthrough was the scheme.

## Slide 10 · Voting · 1:00 (5:35) · Jason

The scheme that worked is voting.
Anthropic lists five workflow patterns for building with LLMs. Voting is one of them: run the same task several times, and let code compare the answers.
Here is ours.
Two readers, both gpt-5.6-luna, read the letter at the same time. Each returns a JSON.
Code compares them, field by field.
If they agree, that is the answer.
If they differ, a stronger model, gpt-5.6-terra, reads the letter once and decides.
If it matches neither, the whole letter is read again, up to five rounds.
If it still fails, the screen says so.
No model decides any of this. It is all code.

## Slide 11 · Abstention · 0:25 (6:00) · Jason

Anthropic has another method against hallucination: let the model say "I don't know".
Researchers call it abstention.
The model refuses to answer instead of guessing.
In our project, every field comes back with a status and a confidence.
If the status is not confirmed, the answer fails.

## Slide 12 · The result · 0:25 (6:25) · Jason

Voting plus abstention.
Nine hundred and two calls. Fifteen letters. Three hundred rounds.
Not one wrong answer reached the screen.

## Slide 13 · Why not OCR? · 0:40 (7:05) · Jason

Our client asked: why not OCR?
Because these letters are visually rich documents.
The layout carries the meaning: which number sits under which heading.
We ran OCR on this payment panel.
On the page, the bank column and the post column sit side by side.
After OCR, they are interleaved, line by line.
Give that text to an LLM, and it is wrong before it starts.
It's not a hallucination problem. The input data is wrong.

## Slide 14 · What a letter costs to read · 0:15 (7:20) · Jason

We track the cost of every call.
A letter costs about one point four cents on average.
Worst case, five rounds and the stronger model every time: about thirty-five cents.

## Slide 15 · From the client to production · 0:48 (8:08) · Jason

Five people, five different strengths. It took us eight weeks to find them.
This is how a change reaches production.
Gerry talks to the client and tests the prototype with real people. The whole team reviews it.
Each of us writes the technical design for our own module, and it comes to me before anyone writes code.
Then we build. We are all full stack: letters, email and voice.
It all travels in one pull request. Hiruni reviews the tests, against rules she wrote. Sai reviews all of our code.
Sai deploys, so he is our last line of defence.
Stable versions get a tag, so we can always go back. What you just saw is v0.1.0.

## Slide 16 · A vision bigger than one semester · 0:30 (8:38) · Jason

Finally, one more challenge.
Our client has a much bigger vision: a fully automated agent butler.
That is the long-term goal.
AI engineering is an empirical science.
There is a lot of uncertainty, and there are governance problems to solve.
So we keep our references and our data, and we take it step by step.
This semester, step one: get the data right.
Thank you.

## Slide 17 · Questions · Jason

Nothing to say here. This slide stays on screen for questions.
