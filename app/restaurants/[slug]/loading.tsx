export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="container-dg pt-4 sm:pt-6">
      <span className="sr-only">Chargement du restaurant…</span>
      <div className="skeleton h-80 rounded-[28px] sm:rounded-[36px]" />
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 rounded-3xl bg-white p-3 ring-1 ring-line/80">
            <div className="flex-1 space-y-2 py-1">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-3 w-5/6" />
              <div className="skeleton h-4 w-20" />
            </div>
            <div className="skeleton size-28 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
