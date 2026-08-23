import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  Camera,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The public landing page.
 *
 * KAN-28: the copy is the product's own story, the one docs/scope.md and
 * docs/walkthrough/ tell (Margaret, one letter per upload, the two verbs, the
 * promise, the one place a model is called), rather than invented marketing
 * language. The prototype it is drawn from is a phone sketch, but this page is
 * not a phone frame: the project description asks for a responsive web app.
 */

const STEPS = [
  {
    icon: Camera,
    title: "Photograph the letter",
    body: "As many pages as it runs to. The camera stays open across taps, so a three page letter is three taps, not three trips.",
  },
  {
    icon: Search,
    title: "It gets read",
    body: "Who it's from, what to do, by when, how much, and what number to quote. Six facts every time, or a plain “unreadable” rather than silence.",
  },
  {
    icon: Eye,
    title: "You check it, once",
    body: "Read the card, tap once. Nothing on it is editable and nothing on it is a question: the whole job is recognising whether it matches the letter.",
  },
  {
    icon: CalendarDays,
    title: "It's on your calendar",
    body: "A red mark on the due date, a gold mark on each morning you'll be reminded: seven, three and one day before, at nine.",
  },
  {
    icon: CheckCircle2,
    title: "Tick it off",
    body: "The tick is the only state there is. Reminders stop the moment it's set, start again if you untick, and the calendar keeps the answer to “did I pay that”.",
  },
] as const;

const MODEL_WORK = [
  {
    icon: FileText,
    title: "The reading",
    when: "Runs once per upload, on the pages of one letter.",
    body: "It looks at the photographs, not a text dump of them: half of what a letter means is in the arrangement, the box around the number that matters, the column a reference sits in. Six fields come back, each marked sure or unreadable.",
  },
  {
    icon: CheckCircle2,
    title: "Everything after it",
    when: "Ordinary code, all the way to the reminder.",
    body: "Whether a task is overdue is a date comparison in Melbourne time. When a reminder goes out is arithmetic on the due date. Whether to send it is reading the tick at the moment the alarm rings.",
  },
] as const;

const FAILURE_MODES = [
  {
    icon: FileText,
    title: "It says so plainly",
    body: "The letter stays in your list and says it could not be read. No spinner that never ends, and no guess dressed up as a reading.",
  },
  {
    icon: Camera,
    title: "The photographs are kept",
    body: "The paper may already be in the bin, so the photos are the only copy. They stay with the letter, whatever the reading did.",
  },
  {
    icon: ShieldCheck,
    title: "Never your fault",
    body: "An error here never opens by describing something you did. A model that can't read a page usually can't say why, so we don't pretend it can.",
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
    body: "An ageing eye needs roughly 2400ms longer to tell blue from yellow, so blue can't carry anything that has to be caught quickly, and it isn't the primary colour here.",
  },
  {
    swatch: "bg-warn-bg border border-warn/40",
    label: "Colour is never the only signal",
    body: "Overdue is told in bold words, not red: red already means “couldn't read it.” Every state also spells itself out for the colour-blind third of this audience.",
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

      {/* ---------- Hero: one letter, and what comes back ---------- */}
      <section className="px-4 pt-8 pb-16 md:px-8 md:pt-12">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              Every bill still arrives on paper. Photograph it.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground md:text-lg">
              One letter at a time, as many pages as it runs to. DayKeeper reads
              it, you check what it read, and the date inside becomes a task, a
              place on the calendar, and reminders that stop the moment you tick
              it off. You never type a date.
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
              Works from a phone, a tablet, or a computer: the same account, the
              same list, wherever you open it.
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
            Reading the letter was never the hard part.
          </h2>
          <p className="text-balance text-muted-foreground md:text-lg">
            Margaret is 78. Her cataracts are getting worse, and every bill she
            has still comes on paper. She can read a letter, with time and good
            light. But reading it is not enough: the date inside has to survive
            the week between reading the letter and acting on it, and nothing in
            the house is doing that job. Right now her daughter&apos;s phone
            calls are doing that job.
          </p>
          <p className="text-balance font-medium text-foreground">
            DayKeeper does one thing: it makes the date outlive the letter.
          </p>
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
              She never types a date, never sorts pages, never files anything,
              and never opens a settings screen to make any of it work.
              Everything below exists to keep that true.
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
            &ldquo;Nothing happens until you say so, and never from a date you
            haven&apos;t checked.&rdquo;
          </p>
          <p className="mt-4 text-sm text-primary-foreground/85 sm:text-base">
            The calendar has exactly two sources: a confident reading a person
            has seen, or nothing. There is no third path for a date to arrive
            there.
          </p>
        </div>
      </section>

      {/* ---------- Where AI is actually used ---------- */}
      <section className="border-t border-border bg-card/60 px-4 py-14 md:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              One call to a model. Everything else is ordinary code.
            </h2>
            <p className="text-muted-foreground">
              &ldquo;An AI app&rdquo; usually means something vaguer than this.
              The one judgement in the product is reading a letter that was
              drawn for a human eye, and that is the one place a model is
              called.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {MODEL_WORK.map((call) => (
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
            No model access is needed to run DayKeeper end to end. A mock reader
            that hedges and fails on purpose is the default, so the waiting, the
            checking and the failing are all designed and tested before a real
            model is ever connected.
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
              About one letter in eight can&apos;t be read, and this release is
              honest about that rather than clever. A product for this reader is
              judged on the case where the reading fails.
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
              Roughly half of this product&apos;s readers are over seventy. The
              theme you&apos;re looking at right now, Eucalypt &amp; Wattle, is
              built to a stricter rule than most software bothers with.
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
            Let the date outlive the letter.
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Create an account, photograph the letter on the table, and check
            what it finds. That&apos;s the whole onboarding.
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
            DayKeeper &middot; RMIT COSC2648 capstone, Group 1. A student
            prototype, not a live service.
          </span>
        </div>
      </footer>
    </main>
  );
}
