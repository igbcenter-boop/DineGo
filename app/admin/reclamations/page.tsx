import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { answerComplaint, createRefund, processRefund, resolveIncident } from "@/app/actions/admin";
import { COMPLAINT_TYPES, REFUND_STATUS, TICKET_STATUS, dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Réclamations — administration" };

export default async function AdminComplaints(props: PageProps<"/admin/reclamations">) {
  await requireRole("admin");
  const db = createAdminClient();
  const [{ data: complaints }, { data: incidents }, { data: refunds }] = await Promise.all([
    db.from("complaints").select("*, orders(code, total, restaurants(name)), profiles!complaints_client_id_fkey(full_name, phone)").order("created_at", { ascending: false }),
    db.from("incidents").select("*, orders(code), profiles(full_name, role)").order("created_at", { ascending: false }),
    db.from("refunds").select("*, orders(code, total, payment_method)").order("created_at", { ascending: false }),
  ]);
  return (
    <div className="container-dg mt-8 space-y-10">
      <h1 className="h1">Réclamations, incidents et remboursements</h1>
      <Flash searchParams={props.searchParams} />

      <section className="space-y-2">
        <h2 className="h2">Réclamations clients</h2>
        {complaints?.length ? (
          complaints.map((c) => {
            const o = c.orders as unknown as { code: string; total: number; restaurants: { name: string } } | null;
            const client = c.profiles as unknown as { full_name: string; phone: string | null } | null;
            return (
              <div key={c.id} className="card space-y-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-violet">
                    {COMPLAINT_TYPES[c.type]} · {o ? `${o.code} (${o.restaurants?.name}, ${fcfa(o.total)})` : "sans commande"} · {client?.full_name} {client?.phone ?? ""}
                  </p>
                  <StatusBadge status={c.status} label={TICKET_STATUS[c.status]} />
                </div>
                <p>{c.description}</p>
                <p className="text-xs text-muted">{dateTime(c.created_at)}</p>
                {c.response && <p className="rounded-lg bg-lilac/60 px-3 py-2 text-xs">Réponse : {c.response}</p>}
                <form action={answerComplaint} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="response" defaultValue={c.response ?? ""} placeholder="Réponse au client" aria-label="Réponse" className="input min-w-64 flex-1 py-1.5" />
                  <select name="status" defaultValue={c.status === "open" ? "in_progress" : c.status} aria-label="Statut" className="input w-36 py-1.5">
                    <option value="in_progress">En cours</option>
                    <option value="resolved">Résolue</option>
                    <option value="rejected">Rejetée</option>
                  </select>
                  <SubmitButton className="btn-primary btn-sm">Répondre</SubmitButton>
                </form>
              </div>
            );
          })
        ) : (
          <Empty>Aucune réclamation.</Empty>
        )}
      </section>

      <section id="incidents" className="scroll-mt-20 space-y-2">
        <h2 className="h2">Incidents de livraison</h2>
        {incidents?.length ? (
          incidents.map((i) => (
            <div key={i.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <strong className="text-violet">{(i.orders as unknown as { code: string })?.code}</strong> · {i.type === "non_livree" ? "Non livrée" : "Autre"} · {i.reason} — {(i.profiles as unknown as { full_name: string })?.full_name}, {dateTime(i.created_at)}
                {i.resolution ? ` · Suite : ${i.resolution}` : ""}
              </span>
              {i.status !== "resolved" ? (
                <form action={resolveIncident} className="flex gap-2">
                  <input type="hidden" name="id" value={i.id} />
                  <input name="resolution" placeholder="Suite donnée" aria-label="Suite donnée" className="input w-48 py-1.5" />
                  <SubmitButton className="btn-primary btn-sm">Clore</SubmitButton>
                </form>
              ) : (
                <StatusBadge status="resolved" label="Clos" />
              )}
            </div>
          ))
        ) : (
          <Empty>Aucun incident.</Empty>
        )}
      </section>

      <section id="remboursements" className="scroll-mt-20 space-y-2">
        <h2 className="h2">Remboursements</h2>
        <form action={createRefund} className="card flex flex-wrap gap-2">
          <input name="order_code" required placeholder="N° commande (DG-…)" aria-label="Numéro de commande" className="input w-40" />
          <input name="amount" type="number" min={1} required placeholder="Montant" aria-label="Montant" className="input w-32" />
          <input name="reason" required placeholder="Motif" aria-label="Motif" className="input min-w-48 flex-1" />
          <SubmitButton>Créer une demande</SubmitButton>
        </form>
        {refunds?.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead><tr><th>Date</th><th>Commande</th><th>Montant</th><th>Motif</th><th>Statut</th><th>Traitement</th></tr></thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id}>
                    <td>{dateTime(r.created_at)}</td>
                    <td>{(r.orders as unknown as { code: string })?.code}</td>
                    <td>{fcfa(r.amount)}</td>
                    <td>{r.reason}{r.processing_note ? ` · ${r.processing_note}` : ""}</td>
                    <td><StatusBadge status={r.status} label={REFUND_STATUS[r.status]} /></td>
                    <td>
                      {r.status !== "paid" && r.status !== "rejected" && (
                        <form action={processRefund} className="flex gap-1">
                          <input type="hidden" name="id" value={r.id} />
                          <input name="note" placeholder="Note / réf." aria-label="Note" className="input w-28 py-1" />
                          <select name="status" aria-label="Décision" className="input w-32 py-1" defaultValue={r.status === "approved" ? "paid" : "approved"}>
                            <option value="approved">Approuver</option>
                            <option value="paid">Remboursé</option>
                            <option value="rejected">Rejeter</option>
                          </select>
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
          <Empty>Aucun remboursement.</Empty>
        )}
      </section>
    </div>
  );
}
