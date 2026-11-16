import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";
import { Bike, Clock, Inbox, MapPin, Star, Store } from "lucide-react";
import { ORDER_STATUS, PRICE_LEVEL, isOpenNow } from "@/lib/format";
import { Toast } from "@/components/Toast";

/** Message de retour après une action (?ok=… / ?error=…), affiché en toast. */
export async function Flash({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  if (!ok && !error) return null;
  return <Toast kind={error ? "error" : "ok"} message={(error ?? ok) as string} />;
}

type Tone = "violet" | "orange" | "green" | "red" | "blue" | "neutral";
const TONES: Record<Tone, string> = {
  violet: "bg-lilac text-violet [--dot:#4b176d]",
  orange: "bg-cream text-orange-700 [--dot:#ff8a24]",
  green: "bg-emerald-50 text-emerald-800 [--dot:#10b981]",
  red: "bg-red-50 text-red-700 [--dot:#ef4444]",
  blue: "bg-sky-50 text-sky-800 [--dot:#0ea5e9]",
  neutral: "bg-zinc-100 text-zinc-700 [--dot:#a1a1aa]",
};

const STATUS_TONE: Record<string, Tone> = {
  sent: "violet",
  received: "violet",
  accepted: "blue",
  preparing: "orange",
  ready: "orange",
  awaiting_pickup: "orange",
  delivering: "orange",
  handed_over: "green",
  completed: "green",
  refused: "red",
  cancelled: "red",
  not_delivered: "red",
  pending: "orange",
  confirmed: "green",
  failed: "red",
  refunded: "blue",
  partially_refunded: "blue",
  active: "green",
  suspended: "red",
  rejected: "red",
  late: "red",
  partial: "orange",
  paid: "green",
  open: "orange",
  in_progress: "blue",
  resolved: "green",
  requested: "orange",
  approved: "blue",
  due: "orange",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`badge ${TONES[STATUS_TONE[status] ?? "neutral"]}`}>
      <span className="size-1.5 rounded-full bg-[var(--dot)]" aria-hidden />
      {label ?? ORDER_STATUS[status] ?? status}
    </span>
  );
}

/** Frise de suivi de commande (§4.8), adaptée au mode livraison ou retrait. */
export function OrderTimeline({ status, mode }: { status: string; mode: "delivery" | "pickup" }) {
  const steps =
    mode === "delivery"
      ? ["sent", "received", "accepted", "preparing", "ready", "delivering", "handed_over", "completed"]
      : ["sent", "received", "accepted", "preparing", "ready", "awaiting_pickup", "handed_over", "completed"];
  if (["refused", "cancelled", "not_delivered"].includes(status))
    return <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">Commande {ORDER_STATUS[status].toLowerCase()}.</p>;
  const idx = steps.indexOf(status === "awaiting_pickup" && mode === "delivery" ? "ready" : status);
  const pct = Math.max(0, idx) / (steps.length - 1);
  return (
    <div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-lilac" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-orange to-orange-500 transition-all duration-700" style={{ width: `${Math.max(6, pct * 100)}%` }} />
      </div>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {steps.map((s, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <li key={s} className="flex items-center gap-2.5 text-xs" aria-current={current ? "step" : undefined}>
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold transition-colors ${
                  done ? "bg-orange text-violet-800" : current ? "bg-violet text-white ring-4 ring-lilac-200" : "bg-lilac text-violet-300"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={current ? "font-extrabold text-violet" : done ? "font-semibold text-ink" : "text-muted"}>{ORDER_STATUS[s]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star className="size-4 fill-orange text-orange" aria-hidden />
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

const COVER_GRADIENTS = [
  "from-violet via-violet-500 to-violet-400",
  "from-orange-600 via-orange to-orange-500",
  "from-violet-700 via-violet to-orange-600",
  "from-violet-500 via-violet-400 to-orange-500",
];

/** Visuel de couverture : photo du restaurant ou dégradé de la charte avec l'icône de sa catégorie. */
export function Cover({
  r,
  className = "",
  morph = true,
}: {
  r: Pick<RestaurantCardData, "id" | "cover_url" | "categories" | "name">;
  className?: string;
  /** Transition partagée carte → page du restaurant (un seul exemplaire par page). */
  morph?: boolean;
}) {
  const g = COVER_GRADIENTS[r.id.charCodeAt(0) % COVER_GRADIENTS.length];
  const visual = (
      <div className={`relative overflow-hidden bg-gradient-to-br ${g} ${className}`}>
        {r.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.cover_url} alt={`Photo de ${r.name}`} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <>
            <div className="pattern-dots absolute inset-0" aria-hidden />
            <span className="absolute -right-4 -bottom-6 text-[7rem] leading-none opacity-90 drop-shadow-xl select-none" aria-hidden>
              {r.categories?.icon ?? "🍽️"}
            </span>
          </>
        )}
      </div>
  );
  return morph ? <ViewTransition name={`cover-${r.id}`}>{visual}</ViewTransition> : visual;
}

export function RestaurantCard({ r, morph = true }: { r: RestaurantCardData; morph?: boolean }) {
  const open = isOpenNow(r);
  return (
    <Link href={`/restaurants/${r.slug}`} className="group card-hover block overflow-hidden rounded-3xl border border-line/80 bg-white shadow-[var(--shadow-soft)]">
      <div className="relative">
        <Cover r={r} morph={morph} className="h-40 transition-transform duration-500 group-hover:scale-[1.03]" />
        <span className={`badge absolute top-3 left-3 bg-white/95 shadow-sm backdrop-blur ${open ? "text-emerald-700" : "text-red-600"}`}>
          <span className={`size-1.5 rounded-full ${open ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden />
          {open ? "Ouvert" : "Fermé"}
        </span>
        {r.rating_count > 0 && (
          <span className="badge absolute top-3 right-3 bg-white/95 text-ink shadow-sm backdrop-blur">
            <Star className="size-3 fill-orange text-orange" aria-hidden />
            {Number(r.rating_avg).toFixed(1).replace(".", ",")}
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="text-[17px] font-extrabold tracking-tight text-violet">{r.name}</h3>
        <div className="space-y-1 text-xs text-muted">
          <p className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-violet/70">{r.categories?.name ?? "Restaurant"}</span>
            <span className="shrink-0 font-bold tracking-wider text-orange-700" title={PRICE_LEVEL[r.price_level]}>
              {"F".repeat(r.price_level)}
              <span className="text-orange-700/25">{"F".repeat(3 - r.price_level)}</span>
              <span className="sr-only"> {PRICE_LEVEL[r.price_level]}</span>
            </span>
          </p>
          <p className="flex items-center gap-1 truncate">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {r.zones?.name ? `${r.zones.name}, ` : ""}
            {r.city}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {r.offers_delivery && (
            <span className="chip py-1"><Bike className="size-3.5" aria-hidden /> Livraison</span>
          )}
          {r.offers_pickup && (
            <span className="chip bg-cream py-1 text-orange-700"><Store className="size-3.5" aria-hidden /> Retrait sur place</span>
          )}
          {r.opens_at && r.closes_at && (
            <span className="chip bg-transparent px-1 py-1 text-muted"><Clock className="size-3.5" aria-hidden /> {r.opens_at.slice(0, 5)}–{r.closes_at.slice(0, 5)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

const KPI_TONE = {
  violet: { text: "text-violet", icon: "bg-lilac text-violet" },
  orange: { text: "text-orange-700", icon: "bg-cream text-orange-700" },
  red: { text: "text-red-700", icon: "bg-red-50 text-red-600" },
  green: { text: "text-emerald-700", icon: "bg-emerald-50 text-emerald-700" },
};

export function Kpi({ label, value, hint, tone = "violet", icon }: { label: string; value: ReactNode; hint?: string; tone?: keyof typeof KPI_TONE; icon?: ReactNode }) {
  const t = KPI_TONE[tone];
  return (
    <div className="rounded-3xl border border-line/80 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-muted">{label}</p>
        {icon && <span className={`grid size-8 place-items-center rounded-xl ${t.icon}`}>{icon}</span>}
      </div>
      <p className={`mt-2 text-lg leading-tight font-extrabold tracking-tight whitespace-nowrap sm:text-xl ${t.text}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-lilac-300 bg-white/60 px-6 py-10 text-center text-sm text-muted">
      <span className="grid size-12 place-items-center rounded-2xl bg-lilac text-violet-400">
        <Inbox className="size-6" aria-hidden />
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Section({ title, children, action, eyebrow }: { title: string; children: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h2 className="h2">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
