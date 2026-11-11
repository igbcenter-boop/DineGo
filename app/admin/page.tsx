import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Banner, BannerChips } from "@/components/Banner";
import { Flash, Kpi, Section } from "@/components/ui";
import { fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Administration" };

function Breakdown({ title, rows }: { title: string; rows: [string, number, number][] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="table-dg">
        <thead><tr><th>{title}</th><th className="text-right">Commandes</th><th className="text-right">Valeur</th></tr></thead>
        <tbody>
          {rows.slice(0, 10).map(([k, c, v]) => (
            <tr key={k}><td>{k}</td><td className="text-right">{c}</td><td className="text-right">{fcfa(v)}</td></tr>
          ))}
          {!rows.length && <tr><td colSpan={3} className="text-center text-muted">Aucune donnée</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminHome(props: PageProps<"/admin">) {
  await requireRole("admin", "/admin");
  const db = createAdminClient();
  const [restaurants, clients, orders, fin, settlements, refunds, anomalies, complaints, reviews, missions, couriers, payments] = await Promise.all([
    db.from("restaurants").select("id, name, status, city, categories(name)"),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client"),
    db.from("orders").select("id, status, total, mode, restaurant_id, created_at, completed_at, payment_status"),
    db.from("order_financials").select("restaurant_share, courier_share, dinego_share, orders!inner(status)").eq("orders.status", "completed"),
    db.from("settlements").select("direction, amount_due, amount_paid, status"),
    db.from("refunds").select("amount, status"),
    db.from("anomalies").select("status"),
    db.from("complaints").select("status"),
    db.from("reviews").select("rating_restaurant, rating_service"),
    db.from("delivery_missions").select("courier_id, status"),
    db.from("couriers").select("id, status"),
    db.from("payments").select("status"),
  ]);
  const R = restaurants.data ?? [];
  const O = orders.data ?? [];
  const byId = new Map(R.map((r) => [r.id, r]));
  const done = O.filter((o) => o.status === "completed");
  const delivered = done.filter((o) => o.mode === "delivery");
  const avgMinutes = delivered.length
    ? Math.round(delivered.reduce((a, o) => a + (new Date(o.completed_at ?? o.created_at).getTime() - new Date(o.created_at).getTime()), 0) / delivered.length / 60000)
    : 0;
  const F = fin.data ?? [];
  const S = settlements.data ?? [];
  const group = (key: (o: (typeof O)[number]) => string) => {
    const m = new Map<string, [number, number]>();
    for (const o of O) {
      const k = key(o);
      const cur = m.get(k) ?? [0, 0];
      m.set(k, [cur[0] + 1, cur[1] + o.total]);
    }
    return [...m.entries()].map(([k, [c, v]]) => [k, c, v] as [string, number, number]).sort((a, b) => b[1] - a[1]);
  };
  const rev = reviews.data ?? [];
  const avg = (k: "rating_restaurant" | "rating_service") => (rev.length ? (rev.reduce((a, r) => a + r[k], 0) / rev.length).toFixed(2).replace(".", ",") : "—");
  const C = complaints.data ?? [];
  const activeCouriers = new Set((missions.data ?? []).filter((m) => ["accepted", "picked_up", "arrived", "delivered"].includes(m.status)).map((m) => m.courier_id));

  return (
    <>
      <Banner
        tone="white"
        crumbs={[{ label: "Administration" }]}
        title="Pilotage de"
        highlight="la plateforme."
        text="Restaurants, livreurs, commandes, paiements, reversements et réconciliation financière."
        illustration="shield"
      >
        <BannerChips
          items={[
            { label: "Validations", href: "/admin/restaurants" },
            { label: "Commandes", href: "/admin/commandes" },
            { label: "Finances", href: "/admin/finances" },
            { label: "Réclamations", href: "/admin/reclamations" },
            { label: "Paramètres", href: "/admin/parametres" },
          ]}
        />
      </Banner>
      <div className="container-dg mt-8 space-y-10">
        <Flash searchParams={props.searchParams} />
        <Section title="Indicateurs commerciaux">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Restaurants inscrits" value={R.length} hint={`${R.filter((r) => r.status === "pending").length} en attente de validation`} />
            <Kpi label="Restaurants actifs" value={R.filter((r) => r.status === "active").length} tone="green" />
            <Kpi label="Commandes" value={O.length} />
            <Kpi label="Valeur totale des commandes" value={fcfa(O.reduce((a, o) => a + o.total, 0))} />
            <Kpi label="Clients" value={clients.count ?? 0} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Breakdown title="Par restaurant" rows={group((o) => byId.get(o.restaurant_id)?.name ?? "—")} />
            <Breakdown title="Par ville" rows={group((o) => byId.get(o.restaurant_id)?.city ?? "—")} />
            <Breakdown title="Par catégorie" rows={group((o) => (byId.get(o.restaurant_id)?.categories as unknown as { name: string } | null)?.name ?? "—")} />
          </div>
        </Section>

        <Section title="Indicateurs de livraison">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Kpi label="Livraisons effectuées" value={delivered.length} tone="green" />
            <Kpi label="En attente / en cours" value={O.filter((o) => o.mode === "delivery" && ["accepted", "preparing", "ready", "awaiting_pickup", "delivering"].includes(o.status)).length} />
            <Kpi label="Annulées" value={O.filter((o) => o.mode === "delivery" && o.status === "cancelled").length} tone="red" />
            <Kpi label="Délai moyen" value={avgMinutes ? `${avgMinutes} min` : "—"} hint="Commande → fin" />
            <Kpi label="Incidents" value={O.filter((o) => o.status === "not_delivered").length} tone="orange" />
            <Kpi label="Livreurs actifs" value={`${activeCouriers.size} / ${(couriers.data ?? []).filter((c) => c.status === "active").length}`} />
          </div>
        </Section>

        <Section title="Indicateurs financiers">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Chiffre d'affaires généré" value={fcfa(done.reduce((a, o) => a + o.total, 0))} />
            <Kpi label="Revenus DineGo" value={fcfa(F.reduce((a, f) => a + f.dinego_share, 0))} tone="green" />
            <Kpi label="Dus aux restaurants" value={fcfa(F.reduce((a, f) => a + f.restaurant_share, 0))} />
            <Kpi label="Dus aux livreurs" value={fcfa(F.reduce((a, f) => a + f.courier_share, 0))} />
            <Kpi label="Reversements effectués" value={fcfa(S.reduce((a, s) => a + s.amount_paid, 0))} />
            <Kpi label="Reversements en retard" value={S.filter((s) => s.status === "late").length} tone="red" />
            <Kpi label="Paiements échoués" value={(payments.data ?? []).filter((p) => p.status === "failed").length} tone="red" />
            <Kpi label="Remboursements" value={fcfa((refunds.data ?? []).filter((r) => r.status === "paid").reduce((a, r) => a + r.amount, 0))} />
            <Kpi label="Écarts financiers ouverts" value={(anomalies.data ?? []).filter((a) => a.status === "open" || a.status === "in_progress").length} tone="orange" />
          </div>
        </Section>

        <Section title="Indicateurs de satisfaction">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Nombre d'avis" value={rev.length} />
            <Kpi label="Note moyenne des restaurants" value={avg("rating_restaurant")} />
            <Kpi label="Satisfaction service" value={avg("rating_service")} />
            <Kpi label="Réclamations reçues" value={C.length} />
            <Kpi label="Réclamations résolues" value={C.filter((c) => c.status === "resolved").length} tone="green" />
          </div>
        </Section>
      </div>
    </>
  );
}
