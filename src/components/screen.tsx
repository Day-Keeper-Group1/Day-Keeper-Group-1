// KAN-57: the three pieces every screen is built from, taken from the prototype.

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The title of a screen, and the sentence under it.
 *
 * The prototype's h1 plus its `.sub` line, with `action` sitting to the right
 * of the title the way the calendar's Today button does (`.cal-screen-head`).
 * The subtitle is set at the base size rather than the sketch's 14.5px:
 * docs/theme.md asks for new screens to be built at the larger scale, and this
 * line is read, not decoration.
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
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {subtitle ? (
        <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>
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
 * `title` is the small uppercase heading the prototype uses. It is `text-sm`
 * because it labels the card rather than being read as prose, which is one of
 * the two places the size floor does not apply.
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
        "rounded-xl border-2 border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      {title ? (
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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
 * button would compete with the thing the screen is actually asking for.
 */
export function PillButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      className={cn("min-h-12 rounded-full font-semibold", className)}
      {...props}
    />
  );
}
