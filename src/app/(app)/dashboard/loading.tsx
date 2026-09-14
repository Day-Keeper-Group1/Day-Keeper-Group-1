// KAN-57: the shape of Home, held while the payload is read.

/**
 * The same blocks in the same places as the screen that replaces it: the
 * greeting, the call to action, and the tasks. A skeleton that is a different
 * shape from the page is a flinch, and this reader is the last person who
 * should have to watch the furniture move.
 */
export default function HomeLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your home screen">
      <div className="mb-[18px] space-y-1.5">
        <div className="h-7 w-60 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="h-20 animate-pulse rounded-[10px] bg-muted" />

        <div className="space-y-3 rounded-[10px] border-2 border-line bg-card p-4">
          <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <div className="size-[26px] shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="h-5 flex-1 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
