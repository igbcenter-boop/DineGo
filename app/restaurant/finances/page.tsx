import type { Metadata } from "next";
import { requireMyRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash, Kpi, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { restaurantVerifyPayment } from "@/app/actions/restaurant";
import { restaurantStatement } from "@/lib/statements";
import { generateSettlements } from "@/lib/orders";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Finances" };

export default async function RestaurantFinances(props: PageProps<"/restaurant/finances">) {
  const { restaurant } = await requireMyRestaurant();
  await generateSettlements(restaurant.id);
  const sp = await props.searchParams;
  const f = {
    from: typeof sp.from === "string" ? sp.from : "",
    to: typeof sp.to === "string" ? sp.to : "",
    status: typeof sp.status === "string" ? sp.status : "",
    code: typeof sp.code === "string" ? sp.code : "",
  };
  const rows = await restaurantStatement(restaurant.id, f);
  const db = createAdminClient();
  const [{ data: settlements }, { data: toVerify }] = await Promise.all([
    db.from("settlements").select("direction, amount_due, amount_paid, status").eq("restaurant_id", restaurant.id),
    db
      .from("payments")
      .select("id, amount, method, reference, created_at, orders!inner(id, code, restaurant_id)")
      .eq("orders.restaurant_id", restaurant.id)
      .eq("beneficiary", "restaurant")
      .eq("status", "pending")
      .neq("method", "cash"),
  ]);
  const completed = rows.filter((r) => r.status === "completed");
  const sum = (fn: (r: (typeof rows)[number]) => number) => completed.reduce((a, r) => a + fn(r), 0);
  const settled = (dir: string, field: "amount_paid" | "due") =>
    (settlements ?? []).filter((x) => x.direction === dir).reduce((a, x) => a + (field === "amount_paid" ? x.amount_paid : x.amount_due - x.amount_paid), 0);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();

  return (
    <div className="container-dg mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Finances</h1>
        <a href={`/restaurant/finances/export${qs ? `?${qs}` : ""}`} className="btn-outline btn-sm">Télécharger le relevé (CSV)</a>
      </div>
      <Flash searchParams={props.searchParams} />

      <form className="card grid gap-3 sm:grid-cols-5" aria-label="Filtres">
        <div><label className="label" htmlFor="from">Du</label><input id="from" name="from" type="date" defaultValue={f.from} className="input" /></div>
        <div><label className="label" htmlFor="to">Au</label><input id="to" name="to" type="date" defaultValue={f.to} className="input" /></div>
        <div>
          <label className="label" htmlFor="status">Statut</label>
          <select id="status" name="status" defaultValue={f.status} className="input">
            <option value="">Tous</option>
            {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="code">Commande</label><input id="code" name="code" defaultValue={f.code} placeholder="DG-…" className="input" /></div>
        <div className="flex items-end"><button className="btn-primary w-full">Filtrer</button></div>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Montant total des commandes" value={fcfa(sum((r) => r.total))} hint={`${completed.length} commande(s) terminée(s)`} />
        <Kpi label="Montant de vos ventes" value={fcfa(sum((r) => r.fin?.restaurant_share ?? 0))} tone="green" />
        <Kpi label="Commissions DineGo" value={fcfa(sum((r) => r.fin?.dinego_share ?? 0))} />
        <Kpi label="Frais de livraison" value={fcfa(sum((r) => r.delivery_fee))} />
        <Kpi label="Rémunérations livreurs" value={fcfa(sum((r) => r.fin?.courier_share ?? 0))} />
        <Kpi label="Encaissé par vous" value={fcfa(sum((r) => (r.fin?.collector === "restaurant" ? r.fin.collected_amount : 0)))} />
        <Kpi label="Reversé à DineGo" value={fcfa(settled("to_dinego", "amount_paid"))} />
        <Kpi label="Restant dû à DineGo" value={fcfa(settled("to_dinego", "due"))} tone="orange" />
        <Kpi label="Reçu de DineGo" value={fcfa(settled("to_restaurant", "amount_paid"))} />
        <Kpi label="À recevoir de DineGo" value={fcfa(settled("to_restaurant", "due"))} />
        <Kpi label="Remboursements" value={fcfa(rows.reduce((a, r) => a + r.refunded, 0))} tone="red" />
        <Kpi label="Mode d'encaissement actuel" value={restaurant.collection_mode === "dinego" ? "DineGo" : "Restaurant"} hint={restaurant.collection_mode === "restaurant" ? `Reversement ${restaurant.remittance_frequency === "daily" ? "quotidien" : "hebdomadaire"}` : undefined} />
      </div>

      {!!toVerify?.length && (
        <section id="paiements" className="scroll-mt-20 space-y-2">
          <h2 className="h2">Paiements numériques à vérifier</h2>
          {toVerify.map((p) => {
            const o = p.orders as unknown as { id: string; code: string };
            return (
              <form key={p.id} action={restaurantVerifyPayment} className="card flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="order_id" value={o.id} />
                <input type="hidden" name="back" value="/restaurant/finances" />
                <span className="flex-1">
                  <strong>{o.code}</strong> · {PAYMENT_METHOD[p.method]} · {fcfa(p.amount)} · réf. client : {p.reference ?? "non transmise"}
                </span>
                <input name="provider_reference" placeholder="Réf. vérifiée chez l'opérateur" aria-label="Référence opérateur" className="input w-56 py-1.5" />
                <SubmitButton className="btn-primary btn-sm" name="decision" value="confirm">Confirmer</SubmitButton>
                <SubmitButton className="btn-ghost btn-sm" name="decision" value="fail">Échoué</SubmitButton>
              </form>
            );
          })}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="h2">Historique des opérations</h2>
        {rows.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead>
                <tr>
                  <th>Commande</th><th>Date</th><th>Statut</th><th>Paiement</th><th>Encaissé par</th><th>Total</th><th>Votre part</th><th>Livreur</th><th>DineGo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-bold">{r.code}</td>
                    <td>{dateTime(r.created_at)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{PAYMENT_METHOD[r.payment_method]} · {PAYMENT_STATUS[r.payment_status]}</td>
                    <td>{r.fin?.collector === "restaurant" ? "Restaurant" : "DineGo"}</td>
                    <td>{fcfa(r.total)}</td>
                    <td>{fcfa(r.fin?.restaurant_share)}</td>
                    <td>{fcfa(r.fin?.courier_share)}</td>
                    <td>{fcfa(r.fin?.dinego_share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucune opération sur cette période.</Empty>
        )}
      </section>
    </div>
  );
}
