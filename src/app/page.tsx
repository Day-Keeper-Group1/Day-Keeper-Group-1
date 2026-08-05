import Link from "next/link";
import { Bell, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOOP_STEPS = [
  {
    icon: Upload,
    title: "Upload a photo",
    description: "Take a photo of any letter, bill, or form.",
  },
  {
    icon: CheckCircle2,
    title: "Check what it found",
    description: "Confirm or correct what DayKeeper read from it.",
  },
  {
    icon: Bell,
    title: "Get reminded",
    description: "See what's due and when, in one place.",
  },
];

export default function PublicEntryPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-4 md:px-8">
        <span className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            D
          </span>
          <span className="text-base font-semibold text-foreground">
            DayKeeper
          </span>
        </span>
      </header>

      <div className="flex flex-1 items-center px-4 pt-8 pb-16 md:px-8">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-12 md:grid-cols-2">
          <div className="space-y-6">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              Your letters and bills, organised for you.
            </h1>
            <p className="max-w-md text-base text-muted-foreground">
              Upload a photo of any letter or bill. DayKeeper reads it,
              checks it with you, and reminds you what to do next.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" render={<Link href="/register">Create account</Link>} />
              <Button
                size="lg"
                variant="outline"
                render={<Link href="/login">Sign in</Link>}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <ul className="space-y-6">
              {LOOP_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <step.icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-card-foreground">
                      {index + 1}. {step.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
