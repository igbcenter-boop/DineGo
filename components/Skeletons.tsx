/** Squelettes de chargement : la page s'affiche immédiatement pendant que les données arrivent. */
export function BannerSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="container-dg pt-4 sm:pt-6" aria-hidden>
      <div className={`skeleton rounded-[28px] sm:rounded-[36px] ${tall ? "h-[420px] md:h-[600px]" : "h-56 md:h-[380px]"}`} />
    </div>
  );
}

export function CardGridSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl bg-white ring-1 ring-line/80">
          <div className="skeleton h-40 rounded-none" />
          <div className="space-y-2.5 p-4">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/2" />
            <div className="flex gap-2 pt-1">
              <div className="skeleton h-6 w-20 rounded-full" />
              <div className="skeleton h-6 w-24 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="container-dg mt-6 space-y-6" aria-hidden>
      <div className="skeleton h-40 rounded-[28px]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-3xl" />
        ))}
      </div>
      <div className="skeleton h-72 rounded-3xl" />
    </div>
  );
}

export function PageLoading({ label = "Chargement…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <BannerSkeleton />
      <div className="container-dg mt-8">
        <CardGridSkeleton n={3} />
      </div>
    </div>
  );
}
