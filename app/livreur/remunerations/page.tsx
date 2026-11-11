import type { Metadata } from "next";
import { requireMyCourier } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Kpi, StatusBadge } from "@/components/ui";
import { dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Rémunérations" };

/** Le livreur ne voit que sa rémunération et les règlements qui le concernent (§7.3). */
export default async function CourierEarnings() {
  const { profile, courier } = await requireMyCourier();
  if (!courier) return <div className="container-dg mt-8"><Empty>Aucun profil livreur.</Empty></div>;
  const db = createAdminClient();
  const [{ data: earnings }, { data: cash }] = await Promise.all([
    db.from("courier_earnings").select("*, orders(code)").eq("courier_id", courier.id).order("created_at", { ascending: false }),
    db.from("cash_confirmations").select("*, orders(code, total)").eq("confirmed_by", profile.id).order("created_at", { ascending: false }),
  ]);
  const total = (earnings ?? []).reduce((a, e) => a + e.amount, 0);
  const paid = (earnings ?? []).filter((e) => e.status === "paid").reduce((a, e) => a + e.amount, 0);
  return (
    <div className="container-dg mt-8 space-y-8">
      <h1 className="h1">Rémunérations et encaissements</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Livraisons rémunérées" value={(earnings ?? []).length} />
        <Kpi label="Total gagné" value={fcfa(total)} tone="green" />
        <Kpi label="Déjà réglé" value={fcfa(paid)} />
        <Kpi label="Reste à percevoir" value={fcfa(total - paid)} tone="orange" />
      </div>
      <section className="space-y-2">
        <h2 className="h2">Détail des rémunérations</h2>
        {earnings?.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead><tr><th>Date</th><th>Commande</th><th>Montant</th><th>Réglé par</th><th>Statut</th></tr></thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id}>
                    <td>{dateTime(e.created_at)}</td>
                    <td>{(e.orders as unknown as { code: string })?.code}</td>
                    <td>{fcfa(e.amount)}</td>
                    <td>{e.paid_by === "dinego" ? "DineGo" : "Restaurant"}</td>
                    <td><StatusBadge status={e.status} label={e.status === "paid" ? `Réglée le ${dateTime(e.paid_at)}` : "À percevoir"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucune rémunération pour le moment.</Empty>
        )}
      </section>
      <section id="encaissements" className="scroll-mt-20 space-y-2">
        <h2 className="h2">Mes confirmations d&apos;encaissement en espèces</h2>
        {cash?.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead><tr><th>Date</th><th>Commande</th><th>Attendu</th><th>Reçu</th></tr></thead>
              <tbody>
                {cash.map((c) => {
                  const o = c.orders as unknown as { code: string; total: number };
                  return (
                    <tr key={c.id}>
                      <td>{dateTime(c.created_at)}</td>
                      <td>{o?.code}</td>
                      <td>{fcfa(o?.total)}</td>
                      <td className={c.amount !== o?.total ? "font-bold text-red-700" : ""}>{fcfa(c.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun encaissement confirmé.</Empty>
        )}
      </section>
    </div>
  );
}
