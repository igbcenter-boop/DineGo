import { DashboardSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <DashboardSkeleton />
    </div>
  );
}
