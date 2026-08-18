import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  Camera,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The public landing page.
 *
 * Rebuilt from docs/walkthrough/ rather than from a generic template: the
 * copy below is the product's own story (Margaret, the pile, the two verbs,
 * the promise, the two places a model is ever called) rather than invented
 * marketing language. The prototype it is drawn from is a phone sketch, but
 * this page is not a phone frame: it is the same content laid out to work at
 * any width, because the project description asks for a responsive web app,
 * not a mobile-only one.
 */

const STEPS = [
  {
    icon: Camera,
    title: "Photograph the pile",
    body: "Whatever came in the post, in whatever order it came to hand. Up to ten photographs in one go, and they don't have to be sorted first.",
  },
  {
    icon: FileText,
    title: "It divides into letters",
    body: "The reading looks at every photograph and works out which ones belong together, in the order they read — not the order the camera happened to take them.",
  },
  {
    icon: Search,
    title: "Each letter gets read",
    body: "Who it's from, what to do, by when, how much, and what number to quote. Six facts, every time, or a plain “unreadable” rather than silence.",
  },
  {
    icon: CheckCircle2,
    title: "You check it, once",
    body: "Read the card, tap once. Nothing on it is editable and nothing on it is a question — the whole job is recognising whether it matches the letter.",
  },
  {
    icon: CalendarDays,
    title: "It's on your calendar",
    body: "A dot for the due date, a dot for each morning you'll be reminded. Tick it off whenever it's done, and change your mind as often as you like.",
  },
] as const;

const MODEL_CALLS = [
  {
    icon: Camera,
    title: "The reading",
    when: "Runs once per upload, over the whole pile.",
    body: "It divides the pile into letters and reads their six fields in the same pass, because the evidence for a page break is visual — a letterhead, a logo, a change of layout — and almost none of it survives being flattened into text first.",
  },
  {
    icon: Search,
    title: "The matcher",
    when: "Runs once per letter, when it might be the rest of something already here.",
    body: "It searches your own archive the way a person would: glob for candidates, grep inside them, read one to decide. No similarity score nobody can argue with — every search and every hit is logged.",
  },
] as const;

const FAILURE_MODES = [
  {
    icon: RotateCcw,
    title: "It was our fault",
    body: "Retried automatically, quietly, up to three times. You're only ever asked to try again if it keeps failing on our side.",
  },
  {
    icon: Camera,
    title: "The photograph was too poor",
    body: "The letter is kept, because the reading that failed was judged against it. Photographing it again, in better light, is the whole fix.",
  },
  {
    icon: ShieldCheck,
    title: "We can't read this kind of writing",
    body: "A handwritten note, for instance. No photograph will fix that, so we say so plainly and keep the photo safe rather than pretending a retake would help.",
  },
] as const;

const DESIGN_RULES = [
  {
    swatch: "bg-ink",
    label: "Body text clears 7:1",
    body: "Not the usual 4.5:1. Contrast sensitivity falls by as much as 83% by age 80, so AA is treated as a floor rather than a target.",
  },
  {
    swatch: "bg-primary",
    label: "Nothing is blue",
    body: "An ageing eye needs roughly 2400ms longer to tell blue from yellow, so blue can't carry anything that has to be caught quickly — and it isn't the primary colour here.",
  },
  {
    swatch: "bg-warn-bg border border-warn/40",
    label: "Colour is never the only signal",
    body: "Overdue is told in bold words, not red — red already means “couldn't read it.” Every state also spells itself out for the colour-blind third of this audience.",
  },
  {
    swatch: "bg-dot-rem",
    label: "Buttons you can actually hit",
    body: "Body text is at least 18px, primary buttons at least 48px tall. Small, precise taps are exactly what shaky hands and tired eyes struggle with.",
  },
] as const;

export default function PublicEntryPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-4 md:px-8">
        <span className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            D
          </span>
          <span className="text-base font-semibold text-foreground">
            DayKeeper
          </span>
        </span>
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      {/* ---------- Hero: the pile, and what comes back ---------- */}
      <section className="px-4 pt-8 pb-16 md:px-8 md:pt-12">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              Every bill still arrives on paper. Photograph the pile.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground md:text-lg">
              Ten photographs, taken in whatever order they came to hand.
              DayKeeper works out which ones belong to which letter, reads
              what each one says, and turns the pile into one list of what to
              do and when — without ever asking you to sort it first.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                render={<Link href="/register">Create account</Link>}
              />
              <Button
                size="lg"
                variant="outline"
                render={<Link href="/login">Sign in</Link>}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Works from a phone, a tablet, or a computer — the same
              account, the same list, wherever you open it.
            </p>
          </div>

          <div className="relative mx-auto flex w-full max-w-sm items-end justify-center gap-4 sm:max-w-md">
            <div className="w-[54%] overflow-hidden rounded-2xl border border-border shadow-lg">
              <Image
                src="/screens/home.png"
                alt="DayKeeper's home screen: a short list of tasks, one overdue, one upcoming."
                width={400}
                height={800}
                className="h-auto w-full"
                priority
              />
            </div>
            <div className="mt-10 w-[54%] overflow-hidden rounded-2xl border border-border shadow-lg">
              <Image
                src="/screens/calendar.png"
                alt="DayKeeper's calendar: due dates in red, reminder mornings in gold."
                width={400}
                height={800}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- The problem, stated concretely ---------- */}
      <section className="border-t border-border bg-card/60 px-4 py-14 md:px-8">
        <div className="mx-auto max-w-4xl space-y-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            There is no rule that sorts a pile like hers.
          </h2>
          <p className="text-balance text-muted-foreground md:text-lg">
            Margaret is 78. Her cataracts are getting worse, and every bill
            she has still comes on paper. Once a week she clears the pile by
            the front door the way anyone would — whatever&apos;s on top,
            then whatever&apos;s under that. Read her photographs in order and
            the problem states itself: the electricity bill turns up on
            photograph one and again on photograph three, with a different
            letter in between. One photograph is of her grandson. One letter
            is too blurred to read. One is handwriting that nothing will ever
            read.
          </p>
          <p className="text-balance font-medium text-foreground">
            Every rule anyone writes down encodes an expectation, and a pile
            picked out of an album has none. So the reading decides where the
            letters divide — not a filing convention nobody agreed to.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-4 text-left sm:grid-cols-3">
            {[
              { label: "Electricity bill", note: "pages 1 and 3, split by another letter" },
              { label: "Council rates notice", note: "the letter in between" },
              { label: "Her grandson", note: "not a letter — becomes nothing" },
              { label: "Registration renewal", note: "too blurred to read" },
              { label: "A doctor's note", note: "handwriting, unreadable" },
              { label: "Two letters, one photo", note: "lying side by side on the table" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <p className="text-sm font-medium text-foreground">
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Two verbs ---------- */}
      <section className="px-4 py-14 md:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              The whole product is two verbs: photograph, and tick.
            </h2>
            <p className="text-muted-foreground">
              She never types a date, never sorts pages, never files
              anything, and never opens a settings screen to make any of it
              work. Everything below exists to keep that true.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <step.icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Step {index + 1}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {step.title}
                </p>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- The promise ---------- */}
      <section className="px-4 pb-14 md:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground sm:px-12">
          <p className="text-xl font-semibold text-balance sm:text-2xl">
            &ldquo;Nothing happens until you say so, and never from a date
            you haven&apos;t checked.&rdquo;
          </p>
          <p className="mt-4 text-sm text-primary-foreground/85 sm:text-base">
            The calendar has exactly two sources: a confident reading a
            person has seen, or nothing. There is no third way for a date to
            arrive there — not a checkpoint that someone could forget to
            add, a missing road.
          </p>
        </div>
      </section>

      {/* ---------- Where AI is actually used ---------- */}
      <section className="border-t border-border bg-card/60 px-4 py-14 md:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Two calls to a model. Everything else is ordinary code.
            </h2>
            <p className="text-muted-foreground">
              &ldquo;An AI app&rdquo; usually means something vaguer than
              this. Whether two pages belong to the same letter is judgement,
              and it&apos;s the model&apos;s. Whether what you have to do has
              changed is <code className="text-xs">!=</code> on four values,
              worked out in code that can be tested.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {MODEL_CALLS.map((call) => (
              <div
                key={call.title}
                className="space-y-3 rounded-xl border border-border bg-card p-6"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <call.icon className="size-5" strokeWidth={1.75} />
                </span>
                <p className="text-base font-semibold text-foreground">
                  {call.title}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {call.when}
                </p>
                <p className="text-sm text-muted-foreground">{call.body}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto max-w-3xl text-center text-sm text-muted-foreground">
            No model access is needed to run DayKeeper end to end. A mock
            reader that hedges and fails on purpose is the default, so the
            waiting, the correcting and the failing are all designed and
            tested before a real model is ever connected.
          </p>
        </div>
      </section>

      {/* ---------- When it doesn't go well ---------- */}
      <section className="px-4 py-14 md:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              When it doesn&apos;t go well
            </h2>
            <p className="text-muted-foreground">
              A product for this reader is judged on the case where the
              reading fails, not the case where it works. Failures are told
              apart by one question: what can you actually do about it?
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {FAILURE_MODES.map((mode) => (
              <div
                key={mode.title}
                className="space-y-2 rounded-xl border border-border bg-card p-5"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-danger-bg text-danger">
                  <mode.icon className="size-4" strokeWidth={1.75} />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {mode.title}
                </p>
                <p className="text-sm text-muted-foreground">{mode.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Designed for eyes that get tired ---------- */}
      <section className="border-t border-border bg-card/60 px-4 py-14 md:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Eye className="size-5" strokeWidth={1.75} />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Designed for eyes that get tired
            </h2>
            <p className="text-muted-foreground">
              Roughly half of this product&apos;s readers are over seventy.
              The theme you&apos;re looking at right now, Eucalypt &amp;
              Wattle, is built to a stricter rule than most software bothers
              with.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DESIGN_RULES.map((rule) => (
              <div
                key={rule.label}
                className="space-y-3 rounded-xl border border-border bg-card p-5"
              >
                <span className={`block size-8 rounded-full ${rule.swatch}`} />
                <p className="text-sm font-semibold text-foreground">
                  {rule.label}
                </p>
                <p className="text-sm text-muted-foreground">{rule.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Closing CTA ---------- */}
      <section className="px-4 py-16 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Bell className="size-5" strokeWidth={1.75} />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Stop sorting the pile yourself.
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Create an account, photograph what&apos;s on the table, and check
            the first thing it finds. That&apos;s the whole onboarding.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              render={<Link href="/register">Create account</Link>}
            />
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/login">Sign in</Link>}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" strokeWidth={1.75} />
            Your letters are never visible to anyone but you.
          </span>
          <span>
            DayKeeper &mdash; RMIT COSC2648 capstone, Group 1. A student
            prototype, not a live service.
          </span>
        </div>
      </footer>
    </main>
  );
}
