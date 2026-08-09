import Link from "next/link";

export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          D
        </span>
        <span className="text-base font-semibold text-foreground">
          DayKeeper
        </span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
