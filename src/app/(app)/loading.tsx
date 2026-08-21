import { PageHeaderSkeleton, StatRowSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <StatRowSkeleton />
      <TableSkeleton rows={7} />
    </div>
  );
}
