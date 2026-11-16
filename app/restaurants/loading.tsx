import { BannerSkeleton, CardGridSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Chargement des restaurants…</span>
      <BannerSkeleton />
      <div className="container-dg mt-8 space-y-5">
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-9 w-28 rounded-full" />
          ))}
        </div>
        <CardGridSkeleton n={6} />
      </div>
    </div>
  );
}
