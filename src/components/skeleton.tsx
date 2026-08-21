import { Card } from "@/components/ui/primitives";

/** Route-level placeholders. Shaped like the real content so nothing jumps. */

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <div className="skeleton h-5 w-40" />
      <div className="skeleton h-3.5 w-64" />
    </div>
  );
}

export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line bg-surface-2 px-3 py-2.5">
        <div className="skeleton h-3 w-32" />
      </div>
      <div className="divide-y divide-line-soft">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <div className="skeleton h-6 w-6 rounded-full" />
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-3 w-24" />
            <div className="skeleton ml-auto h-3 w-16" />
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function StatRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="space-y-2 px-4 py-3">
          <div className="skeleton h-2.5 w-20" />
          <div className="skeleton h-6 w-24" />
          <div className="skeleton h-2.5 w-16" />
        </Card>
      ))}
    </div>
  );
}

export function ListPageSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton />
      <TableSkeleton rows={rows} />
    </div>
  );
}
