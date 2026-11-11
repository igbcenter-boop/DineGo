import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { correctCashConfirmation, resolveAnomaly } from "@/app/actions/admin";
import { ROLE_LABEL, TICKET_STATUS, dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Encaissements — administration" };

export default async function AdminCash(props: PageProps<"/admin/encaissements">) {
  await requireRole("admin");
  const db = createAdminClient();
  const [{ data: anomalies }, { data: confirmations }, { data: corrections }] = await Promise.all([
    db.from("anomalies").select("*, orders(code), profiles!anomalies_reported_by_fkey(full_name)").order("created_at", { ascending: false }),
    db.from("cash_confirmations").select("*, orders(code, total, restaurants(name)), profiles!cash_confirmations_confirmed_by_fkey(full_name)").order("created_at", { ascending: false }).limit(200),
    db.from("cash_corrections").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(100),
  ]);
  return (
    <div className="container-dg mt-8 space-y-8">
      <h1 className="h1">Encaissements en espèces</h1>
      <Flash searchParams={props.searchParams} />

      <section className="space-y-2">
        <h2 className="h2">Anomalies et écarts</h2>
        {anomalies?.length ? (
          anomalies.map((a) => (
            <div key={a.id} className="card space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-violet">
                  {(a.orders as unknown as { code: string } | null)?.code ?? "—"} · signalé par {(a.profiles as unknown as { full_name: string } | null)?.full_name} le {dateTime(a.created_at)}
                </p>
                <StatusBadge status={a.status} label={TICKET_STATUS[a.status]} />
              </div>
              <p>{a.description}</p>
              {a.expected_amount !== null && <p className="text-xs">Attendu {fcfa(a.expected_amount)} · reçu {fcfa(a.received_amount)} · écart <strong className="text-red-700">{fcfa((a.received_amount ?? 0) - a.expected_amount)}</strong></p>}
              {a.resolution && <p className="text-xs text-violet">Suivi : {a.resolution}</p>}
              {a.status !== "resolved" && a.status !== "rejected" && (
                <form action={resolveAnomaly} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <input name="resolution" placeholder="Explication / suite donnée" aria-label="Résolution" className="input w-72 py-1.5" />
                  <select name="status" aria-label="Statut" className="input w-40 py-1.5">
                    <option value="in_progress">En cours</option>
                    <option value="resolved">Résolu</option>
                    <option value="rejected">Rejeté</option>
                  </select>
                  <SubmitButton className="btn-primary btn-sm">Mettre à jour</SubmitButton>
                </form>
              )}
            </div>
          ))
        ) : (
          <Empty>Aucune anomalie.</Empty>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="h2">Confirmations d&apos;encaissement</h2>
        {confirmations?.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead><tr><th>Date</th><th>Commande</th><th>Restaurant</th><th>Confirmé par</th><th>Attendu</th><th>Reçu</th><th>Réf.</th><th>Correction (avec motif)</th></tr></thead>
              <tbody>
                {confirmations.map((c) => {
                  const o = c.orders as unknown as { code: string; total: number; restaurants: { name: string } };
                  return (
                    <tr key={c.id}>
                      <td>{dateTime(c.created_at)}</td>
                      <td>{o?.code}</td>
                      <td>{o?.restaurants?.name}</td>
                      <td>{(c.profiles as unknown as { full_name: string })?.full_name} ({ROLE_LABEL[c.confirmer_role]})</td>
                      <td>{fcfa(o?.total)}</td>
                      <td className={c.amount !== o?.total ? "font-bold text-red-700" : ""}>{fcfa(c.amount)}</td>
                      <td>{c.reference ?? "—"}</td>
                      <td>
                        <form action={correctCashConfirmation} className="flex gap-1">
                          <input type="hidden" name="id" value={c.id} />
                          <input name="amount" type="number" min={0} defaultValue={c.amount} aria-label="Montant corrigé" className="input w-24 py-1" />
                          <input name="reason" required placeholder="Motif" aria-label="Motif" className="input w-28 py-1" />
                          <SubmitButton className="btn-outline btn-sm">Corriger</SubmitButton>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun encaissement en espèces confirmé.</Empty>
        )}
      </section>

      {!!corrections?.length && (
        <section className="space-y-2">
          <h2 className="h2">Historique des corrections</h2>
          <ul className="space-y-1 text-sm">
            {corrections.map((c) => (
              <li key={c.id}>
                {dateTime(c.created_at)} — {fcfa(c.old_amount)} → {fcfa(c.new_amount)} par {(c.profiles as unknown as { full_name: string })?.full_name} : {c.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
