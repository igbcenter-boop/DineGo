import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash, Kpi, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { adminRecordSettlementPayment, adminVerifyPayment, payCourierByDinego, runSettlements } from "@/app/actions/admin";
import { PAYMENT_METHOD, PAYMENT_STATUS, SETTLEMENT_STATUS, dateOnly, dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Finances — administration" };

export default async function AdminFinances(props: PageProps<"/admin/finances">) {
  await requireRole("admin");
  const sp = await props.searchParams;
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f = { restaurant: g("restaurant"), courier: g("courier"), from: g("from"), to: g("to"), zone: g("zone"), method: g("method") };
  const db = createAdminClient();

  let q = db
    .from("orders")
    .select("id, code, created_at, status, total, payment_method, payment_status, zone_id, restaurant_id, courier_id, restaurants(name, zone_id), order_financials(*), refunds(amount, status), cash_confirmations(amount)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (f.restaurant) q = q.eq("restaurant_id", f.restaurant);
  if (f.courier) q = q.eq("courier_id", f.courier);
  if (f.method) q = q.eq("payment_method", f.method);
  if (f.from) q = q.gte("created_at", new Date(f.from + "T00:00:00Z").toISOString());
  if (f.to) q = q.lte("created_at", new Date(f.to + "T23:59:59Z").toISOString());

  const [{ data: ordersRaw }, { data: restaurants }, { data: couriers }, { data: zones }, { data: pending }, { data: settlements }, { data: earnings }] = await Promise.all([
    q,
    db.from("restaurants").select("id, name").order("name"),
    db.from("couriers").select("id, full_name").order("full_name"),
    db.from("zones").select("id, city, name").order("city"),
    db.from("payments").select("id, amount, method, reference, created_at, orders(id, code, restaurants(name))").eq("beneficiary", "dinego").eq("status", "pending").neq("method", "cash").order("created_at"),
    db.from("settlements").select("*, restaurants(name)").order("due_date", { ascending: false }).limit(200),
    db.from("courier_earnings").select("*, couriers(full_name), orders(code)").eq("paid_by", "dinego").eq("status", "due").order("created_at"),
  ]);
  const orders = (ordersRaw ?? []).filter((o) => !f.zone || o.zone_id === f.zone || (o.restaurants as unknown as { zone_id: string } | null)?.zone_id === f.zone);
  type Fin = { collector: string; restaurant_share: number; courier_share: number; dinego_share: number; expected_amount: number; collected_amount: number };
  const fin = (o: (typeof orders)[number]) => (Array.isArray(o.order_financials) ? o.order_financials[0] : o.order_financials) as Fin | null;
  const completed = orders.filter((o) => o.status === "completed");
  const sum = (arr: typeof orders, fn: (o: (typeof orders)[number]) => number) => arr.reduce((a, o) => a + fn(o), 0);
  const refundsPaid = (o: (typeof orders)[number]) => ((o.refunds ?? []) as { amount: number; status: string }[]).filter((r) => r.status === "paid").reduce((a, r) => a + r.amount, 0);
  const S = settlements ?? [];
  const st = (dir: string, fn: (s: (typeof S)[number]) => number) => S.filter((s) => s.direction === dir).reduce((a, s) => a + fn(s), 0);

  // Réconciliation (§13.1) : attendu vs encaissé vs reversé vs restant dû
  const expected = sum(completed, (o) => fin(o)?.expected_amount ?? 0);
  const collected = sum(completed, (o) => fin(o)?.collected_amount ?? 0);
  const gaps = orders.filter((o) => {
    const c = ((o.cash_confirmations ?? []) as unknown as { amount: number }[] | { amount: number } | null);
    const amount = Array.isArray(c) ? c[0]?.amount : c?.amount;
    return amount !== undefined && amount !== o.total;
  });

  return (
    <div className="container-dg mt-8 space-y-8">
      <h1 className="h1">Finances</h1>
      <Flash searchParams={props.searchParams} />
      <form className="card grid gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="Filtres">
        <select name="restaurant" defaultValue={f.restaurant} aria-label="Restaurant" className="input">
          <option value="">Tous restaurants</option>
          {restaurants?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select name="courier" defaultValue={f.courier} aria-label="Livreur" className="input">
          <option value="">Tous livreurs</option>
          {couriers?.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
        <select name="zone" defaultValue={f.zone} aria-label="Zone" className="input">
          <option value="">Toutes zones</option>
          {zones?.map((z) => <option key={z.id} value={z.id}>{z.name} ({z.city})</option>)}
        </select>
        <select name="method" defaultValue={f.method} aria-label="Moyen de paiement" className="input">
          <option value="">Tous moyens</option>
          {Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input name="from" type="date" defaultValue={f.from} aria-label="Du" className="input" />
        <input name="to" type="date" defaultValue={f.to} aria-label="Au" className="input" />
        <div className="flex gap-1"><button className="btn-primary flex-1">Filtrer</button><Link href="/admin/finances" className="btn-ghost">✕</Link></div>
      </form>

      <section className="space-y-3">
        <h2 className="h2">Vue globale</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Volume des commandes" value={orders.length} hint={fcfa(sum(orders, (o) => o.total))} />
          <Kpi label="Montant total encaissé" value={fcfa(collected)} />
          <Kpi label="Revenus DineGo" value={fcfa(sum(completed, (o) => fin(o)?.dinego_share ?? 0))} tone="green" />
          <Kpi label="Sommes dues aux restaurants" value={fcfa(sum(completed, (o) => fin(o)?.restaurant_share ?? 0))} hint="Fonds de tiers, distincts des revenus DineGo" />
          <Kpi label="Sommes dues aux livreurs" value={fcfa(sum(completed, (o) => fin(o)?.courier_share ?? 0))} hint="Fonds de tiers" />
          <Kpi label="Restant à reverser (restaurants → DineGo)" value={fcfa(st("to_dinego", (s) => s.amount_due - s.amount_paid))} tone="orange" />
          <Kpi label="Restant à verser (DineGo → restaurants)" value={fcfa(st("to_restaurant", (s) => s.amount_due - s.amount_paid))} tone="orange" />
          <Kpi label="Reversements effectués" value={fcfa(S.reduce((a, s) => a + s.amount_paid, 0))} />
          <Kpi label="Retards de paiement" value={S.filter((s) => s.status === "late").length} tone="red" />
          <Kpi label="Remboursements" value={fcfa(sum(orders, refundsPaid))} />
          <Kpi label="Transactions échouées" value={orders.filter((o) => o.payment_status === "failed").length} tone="red" />
          <Kpi label="Écarts d'encaissement" value={gaps.length} tone={gaps.length ? "red" : "violet"} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="h2">Réconciliation financière</h2>
        <div className="card overflow-x-auto p-0">
          <table className="table-dg">
            <thead><tr><th>Montants attendus</th><th>Réellement encaissés</th><th>Reversés</th><th>Restant dus</th><th>Remboursements</th><th>Écarts</th></tr></thead>
            <tbody>
              <tr className="text-base font-bold">
                <td>{fcfa(expected)}</td>
                <td>{fcfa(collected)}</td>
                <td>{fcfa(S.reduce((a, s) => a + s.amount_paid, 0))}</td>
                <td>{fcfa(S.reduce((a, s) => a + s.amount_due - s.amount_paid, 0))}</td>
                <td>{fcfa(sum(orders, refundsPaid))}</td>
                <td className={expected - collected ? "text-red-700" : ""}>{fcfa(expected - collected)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {!!gaps.length && <p className="text-sm text-red-700">Commandes avec écart d&apos;encaissement : {gaps.map((o) => o.code).join(", ")} — <Link href="/admin/encaissements" className="underline">voir les anomalies</Link></p>}
      </section>

      <section id="paiements" className="scroll-mt-20 space-y-2">
        <h2 className="h2">Paiements numériques à vérifier (encaissement DineGo)</h2>
        {pending?.length ? (
          pending.map((p) => {
            const o = p.orders as unknown as { id: string; code: string; restaurants: { name: string } };
            return (
              <form key={p.id} action={adminVerifyPayment} className="card flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="order_id" value={o.id} />
                <input type="hidden" name="back" value="/admin/finances#paiements" />
                <span className="flex-1">
                  <strong>{o.code}</strong> · {o.restaurants?.name} · {PAYMENT_METHOD[p.method]} · {fcfa(p.amount)} · réf. client : {p.reference ?? "non transmise"} · {dateTime(p.created_at)}
                </span>
                <input name="provider_reference" placeholder="Réf. vérifiée chez l'opérateur" aria-label="Référence opérateur" className="input w-56 py-1.5" />
                <SubmitButton className="btn-primary btn-sm" name="decision" value="confirm">Confirmer</SubmitButton>
                <SubmitButton className="btn-ghost btn-sm" name="decision" value="fail">Échoué</SubmitButton>
              </form>
            );
          })
        ) : (
          <Empty>Aucun paiement en attente de vérification.</Empty>
        )}
      </section>

      <section id="reversements" className="scroll-mt-20 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">Reversements</h2>
          <form action={runSettlements}><SubmitButton className="btn-violet btn-sm">Constituer les échéances des périodes closes</SubmitButton></form>
        </div>
        {S.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead><tr><th>Restaurant</th><th>Sens</th><th>Période</th><th>Échéance</th><th>Dû</th><th>Payé</th><th>Statut</th><th>Enregistrer un règlement</th></tr></thead>
              <tbody>
                {S.map((s) => (
                  <tr key={s.id}>
                    <td>{(s.restaurants as unknown as { name: string })?.name}</td>
                    <td>{s.direction === "to_dinego" ? "Restaurant → DineGo" : "DineGo → restaurant"}</td>
                    <td>{dateOnly(s.period_start)} → {dateOnly(s.period_end)}</td>
                    <td>{dateOnly(s.due_date)}</td>
                    <td>{fcfa(s.amount_due)}</td>
                    <td>{fcfa(s.amount_paid)}</td>
                    <td><StatusBadge status={s.status} label={SETTLEMENT_STATUS[s.status]} /></td>
                    <td>
                      {s.status !== "paid" && (
                        <form action={adminRecordSettlementPayment} className="flex gap-1">
                          <input type="hidden" name="settlement_id" value={s.id} />
                          <input name="amount" type="number" min={1} defaultValue={s.amount_due - s.amount_paid} aria-label="Montant" className="input w-24 py-1" />
                          <input name="proof" required placeholder="Preuve / réf." aria-label="Preuve" className="input w-28 py-1" />
                          <SubmitButton className="btn-primary btn-sm">OK</SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucune échéance constituée.</Empty>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="h2">Rémunérations des livreurs du réseau à régler</h2>
        {earnings?.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead><tr><th>Date</th><th>Livreur</th><th>Commande</th><th>Montant</th><th /></tr></thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id}>
                    <td>{dateTime(e.created_at)}</td>
                    <td>{(e.couriers as unknown as { full_name: string })?.full_name}</td>
                    <td>{(e.orders as unknown as { code: string })?.code}</td>
                    <td>{fcfa(e.amount)}</td>
                    <td>
                      <form action={payCourierByDinego}>
                        <input type="hidden" name="id" value={e.id} />
                        <SubmitButton className="btn-primary btn-sm">Marquer réglée</SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucune rémunération en attente.</Empty>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="h2">Opérations ({orders.length})</h2>
        <div className="card max-h-[600px] overflow-auto p-0">
          <table className="table-dg">
            <thead><tr><th>Commande</th><th>Date</th><th>Restaurant</th><th>Paiement</th><th>Total</th><th>Restaurant</th><th>Livreur</th><th>DineGo</th><th>Encaissé</th></tr></thead>
            <tbody>
              {orders.map((o) => {
                const x = fin(o);
                return (
                  <tr key={o.id}>
                    <td className="font-bold">{o.code}</td>
                    <td>{dateTime(o.created_at)}</td>
                    <td>{(o.restaurants as unknown as { name: string })?.name}</td>
                    <td>{PAYMENT_METHOD[o.payment_method]} · {PAYMENT_STATUS[o.payment_status]}</td>
                    <td>{fcfa(o.total)}</td>
                    <td>{fcfa(x?.restaurant_share)}</td>
                    <td>{fcfa(x?.courier_share)}</td>
                    <td>{fcfa(x?.dinego_share)}</td>
                    <td>{fcfa(x?.collected_amount)} ({x?.collector === "dinego" ? "DineGo" : "resto"})</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
