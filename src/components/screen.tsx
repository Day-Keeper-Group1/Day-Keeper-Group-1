// KAN-57: the pieces every screen is built from, taken from the prototype.
//
// Sizes are the prototype's own, by name (src/app/globals.css, "The
// prototype's type, by name"), so a screen built from these reads at the same
// proportions as docs/prototype/user/daykeeper-sketch-live.html.

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The title of a screen, and the sentence under it.
 *
 * The prototype's h1 plus its `.sub` line, with `action` sitting to the right
 * of the title the way the calendar's Today button does (`.cal-screen-head`).
 */
export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-[18px]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title font-bold tracking-[-0.2px] text-foreground">
          {title}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {subtitle ? (
        <p className="mt-[3px] text-sub text-ink-dim">{subtitle}</p>
      ) : null}
    </div>
  );
}

/**
 * The prototype's `.card`: everything on a screen sits in one of these.
 *
 * The border is two pixels of `--line` and not a hairline on purpose. A person
 * who cannot find the edge of a card does not know what belongs with what;
 * docs/theme.md keeps that border deliberately dark enough to see.
 *
 * `title` is the prototype's `.card h2`: small, uppercase, spaced out, dim. It
 * labels the card rather than being read.
 *
 * Cards carry no outer margin. The prototype spaces them 14px apart, and the
 * screens do that with a `gap-3.5` on whatever holds them, so a card never
 * pushes on a neighbour it cannot see.
 */
export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[10px] border-2 border-line bg-card p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {title ? (
        <h2 className="mb-3 text-label font-bold tracking-[0.7px] text-ink-dim uppercase">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/**
 * The prototype's `.today-btn`: a quiet, fully rounded outline button.
 *
 * Used for the secondary control beside a screen title, where a filled green
 * button would compete with the thing the screen is actually asking for. It is
 * drawn at the prototype's size, and the area that answers a tap reaches 8px
 * past the pill on every side, so the small drawing is not a small target.
 */
export function PillButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="pill"
      size="pill"
      className={cn(
        "relative after:absolute after:-inset-2 after:content-['']",
        className,
      )}
      {...props}
    />
  );
}
