import Link from "next/link";
import type { ReactNode } from "react";
import { ORDER_STATUS, PRICE_LEVEL, fcfa, isOpenNow } from "@/lib/format";

/** Message de retour après une action (?ok=… / ?error=…). */
export async function Flash({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  if (!ok && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}
    >
      {error ?? ok}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-lilac text-violet",
  received: "bg-lilac text-violet",
  accepted: "bg-blue-50 text-blue-800",
  preparing: "bg-peach text-orange-700",
  ready: "bg-peach text-orange-700",
  awaiting_pickup: "bg-peach text-orange-700",
  delivering: "bg-orange text-violet-700",
  handed_over: "bg-green-50 text-green-800",
  completed: "bg-green-100 text-green-900",
  refused: "bg-red-50 text-red-800",
  cancelled: "bg-red-50 text-red-800",
  not_delivered: "bg-red-50 text-red-800",
  pending: "bg-peach text-orange-700",
  confirmed: "bg-green-100 text-green-900",
  failed: "bg-red-50 text-red-800",
  refunded: "bg-blue-50 text-blue-800",
  partially_refunded: "bg-blue-50 text-blue-800",
  active: "bg-green-100 text-green-900",
  suspended: "bg-red-50 text-red-800",
  rejected: "bg-red-50 text-red-800",
  late: "bg-red-50 text-red-800",
  partial: "bg-peach text-orange-700",
  paid: "bg-green-100 text-green-900",
  open: "bg-peach text-orange-700",
  in_progress: "bg-blue-50 text-blue-800",
  resolved: "bg-green-100 text-green-900",
  requested: "bg-peach text-orange-700",
  approved: "bg-blue-50 text-blue-800",
  due: "bg-peach text-orange-700",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge ${STATUS_COLORS[status] ?? "bg-lilac text-violet"}`}>{label ?? ORDER_STATUS[status] ?? status}</span>;
}

/** Frise de suivi de commande (§4.8), adaptée au mode livraison ou retrait. */
export function OrderTimeline({ status, mode, onDark = false }: { status: string; mode: "delivery" | "pickup"; onDark?: boolean }) {
  const steps =
    mode === "delivery"
      ? ["sent", "received", "accepted", "preparing", "ready", "delivering", "handed_over", "completed"]
      : ["sent", "received", "accepted", "preparing", "ready", "awaiting_pickup", "handed_over", "completed"];
  const stopped = ["refused", "cancelled", "not_delivered"].includes(status);
  const idx = steps.indexOf(status === "awaiting_pickup" && mode === "delivery" ? "ready" : status);
  if (stopped)
    return (
      <p className={`font-bold ${onDark ? "text-white" : "text-red-700"}`}>
        Commande {ORDER_STATUS[status].toLowerCase()}.
      </p>
    );
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {steps.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        return (
          <li key={s} className="flex items-center gap-2 text-xs">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 font-extrabold ${
                done ? "border-orange bg-orange text-violet-700" : current ? "border-orange bg-white text-orange" : onDark ? "border-white/50 text-white/60" : "border-line text-muted"
              }`}
              aria-current={current ? "step" : undefined}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`${current ? "font-extrabold text-orange" : onDark ? "text-white/85" : "text-ink"}`}>{ORDER_STATUS[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-orange">★</span>
      <span className="font-bold">{Number(value).toFixed(1).replace(".", ",")}</span>
      {count !== undefined && <span className="text-muted">({count} avis)</span>}
    </span>
  );
}

export type RestaurantCardData = {
  id: string;
  slug: string;
  name: string;
  city: string;
  cover_url: string | null;
  logo_url: string | null;
  rating_avg: number;
  rating_count: number;
  price_level: number;
  offers_delivery: boolean;
  offers_pickup: boolean;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  categories?: { name: string; icon: string } | null;
  zones?: { name: string } | null;
};

export function RestaurantCard({ r }: { r: RestaurantCardData }) {
  const open = isOpenNow(r);
  return (
    <Link href={`/restaurants/${r.slug}`} className="group overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-36 bg-gradient-to-br from-violet to-violet-500">
        {r.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-5xl" aria-hidden>
            {r.categories?.icon ?? "🍽️"}
          </span>
        )}
        <span className={`badge absolute left-3 top-3 ${open ? "bg-white text-green-800" : "bg-white text-red-700"}`}>{open ? "Ouvert" : "Fermé"}</span>
      </div>
      <div className="space-y-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-extrabold text-violet group-hover:underline">{r.name}</h3>
          {r.rating_count > 0 && <Stars value={r.rating_avg} />}
        </div>
        <p className="text-xs text-muted">
          {r.categories?.name ?? "Restaurant"} · {r.zones?.name ? `${r.zones.name}, ` : ""}
          {r.city} · {PRICE_LEVEL[r.price_level]}
        </p>
        <div className="flex flex-wrap gap-1 pt-1">
          {r.offers_delivery && <span className="chip">Livraison</span>}
          {r.offers_pickup && <span className="chip">Retrait sur place</span>}
        </div>
      </div>
    </Link>
  );
}

export function Kpi({ label, value, hint, tone = "violet" }: { label: string; value: ReactNode; hint?: string; tone?: "violet" | "orange" | "red" | "green" }) {
  const color = { violet: "text-violet", orange: "text-orange-700", red: "text-red-700", green: "text-green-800" }[tone];
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Money({ v }: { v: number | null | undefined }) {
  return <span className="whitespace-nowrap">{fcfa(v)}</span>;
}

/** Barre de navigation des espaces professionnels. */
export function SpaceNav({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <nav aria-label="Rubriques" className="border-b border-line bg-white">
      <div className="container-dg flex gap-1 overflow-x-auto py-2">
        {items.map((i) => {
          const active = current === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${active ? "bg-violet text-white" : "text-violet hover:bg-lilac"}`}
            >
              {i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</p>;
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
