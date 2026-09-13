import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:max-w-md">
        {[1, 2, 3].map((item) => (
          <Card key={item}>
            <CardContent className="space-y-2 p-4">
              <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
              <div className="h-9 w-12 animate-pulse rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
