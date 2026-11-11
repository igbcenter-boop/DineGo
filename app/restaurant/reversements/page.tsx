import type { Metadata } from "next";
import { requireMyRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash, Kpi, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { recordSettlementPayment } from "@/app/actions/restaurant";
import { generateSettlements } from "@/lib/orders";
import { SETTLEMENT_STATUS, dateOnly, dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Reversements" };

export default async function RestaurantSettlements(props: PageProps<"/restaurant/reversements">) {
  const { restaurant } = await requireMyRestaurant();
  await generateSettlements(restaurant.id);
  const db = createAdminClient();
  const { data: settlements } = await db
    .from("settlements")
    .select("*, settlement_payments(amount, proof, created_at)")
    .eq("restaurant_id", restaurant.id)
    .order("period_start", { ascending: false });
  const toDinego = (settlements ?? []).filter((s) => s.direction === "to_dinego");
  const toMe = (settlements ?? []).filter((s) => s.direction === "to_restaurant");
  const due = toDinego.reduce((a, s) => a + s.amount_due, 0);
  const paid = toDinego.reduce((a, s) => a + s.amount_paid, 0);
  const late = toDinego.filter((s) => s.status === "late");

  return (
    <div className="container-dg mt-8 space-y-6">
      <h1 className="h1">Reversements</h1>
      <Flash searchParams={props.searchParams} />
      <p className="text-sm text-muted">
        Mode d&apos;encaissement : <strong>{restaurant.collection_mode === "restaurant" ? "par le restaurant" : "par DineGo"}</strong> · Fréquence de reversement :{" "}
        <strong>{restaurant.remittance_frequency === "daily" ? "quotidienne" : "hebdomadaire"}</strong>. Les échéances sont constituées à la clôture de chaque période.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Sommes dues à DineGo" value={fcfa(due)} />
        <Kpi label="Déjà reversé" value={fcfa(paid)} tone="green" />
        <Kpi label="Restant dû" value={fcfa(due - paid)} tone="orange" />
        <Kpi label="Retards" value={late.length} tone={late.length ? "red" : "violet"} />
      </div>

      <section className="space-y-2">
        <h2 className="h2">Échéances à reverser à DineGo</h2>
        {toDinego.length ? (
          toDinego.map((s) => (
            <div key={s.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-violet">
                  Période du {dateOnly(s.period_start)} au {dateOnly(s.period_end)} · échéance {dateOnly(s.due_date)}
                </p>
                <StatusBadge status={s.status} label={SETTLEMENT_STATUS[s.status]} />
              </div>
              <p className="text-sm">
                Dû : <strong>{fcfa(s.amount_due)}</strong> · Reversé : {fcfa(s.amount_paid)} · Reste : <strong>{fcfa(s.amount_due - s.amount_paid)}</strong>
              </p>
              {(s.settlement_payments as { amount: number; proof: string; created_at: string }[]).map((p, i) => (
                <p key={i} className="text-xs text-muted">✓ {fcfa(p.amount)} le {dateTime(p.created_at)} — preuve : {p.proof}</p>
              ))}
              {s.status !== "paid" && (
                <form action={recordSettlementPayment} className="flex flex-wrap gap-2">
                  <input type="hidden" name="settlement_id" value={s.id} />
                  <input name="amount" type="number" min={1} max={s.amount_due - s.amount_paid} defaultValue={s.amount_due - s.amount_paid} aria-label="Montant reversé" className="input w-36" />
                  <input name="proof" required placeholder="Preuve : réf. Orange Money, reçu…" aria-label="Preuve de paiement" className="input w-64" />
                  <SubmitButton className="btn-primary btn-sm">Déclarer le reversement</SubmitButton>
                </form>
              )}
            </div>
          ))
        ) : (
          <Empty>Aucune échéance pour le moment.</Empty>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="h2">Reversements de DineGo vers le restaurant</h2>
        {toMe.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead><tr><th>Période</th><th>Échéance</th><th>Montant</th><th>Versé</th><th>Statut</th></tr></thead>
              <tbody>
                {toMe.map((s) => (
                  <tr key={s.id}>
                    <td>{dateOnly(s.period_start)} → {dateOnly(s.period_end)}</td>
                    <td>{dateOnly(s.due_date)}</td>
                    <td>{fcfa(s.amount_due)}</td>
                    <td>{fcfa(s.amount_paid)}</td>
                    <td><StatusBadge status={s.status === "late" ? "pending" : s.status} label={s.status === "paid" ? "Versé" : "À verser"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun reversement de DineGo pour le moment.</Empty>
        )}
      </section>
    </div>
  );
}
