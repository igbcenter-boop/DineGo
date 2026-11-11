import type { Metadata } from "next";
import { requireMyCourier } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Banner, BannerChips } from "@/components/Banner";
import { Empty, Flash, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { acceptMission, courierConfirmCash, courierIncident, missionStep, refuseMission, toggleAvailability } from "@/app/actions/courier";
import { MISSION_STATUS, PAYMENT_METHOD, dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Espace livreur" };

export default async function CourierHome(props: PageProps<"/livreur">) {
  const { profile, courier } = await requireMyCourier();
  const db = createAdminClient();
  const { data: missions } = courier
    ? await db
        .from("delivery_missions")
        .select("*, orders(id, code, status, mode, address, contact_phone, total, payment_method, payment_status, notes, restaurants(name, address, phone), profiles!orders_client_id_fkey(full_name))")
        .eq("courier_id", courier.id)
        .order("created_at", { ascending: false })
        .limit(60)
    : { data: [] };
  const ids = (missions ?? []).map((m) => (m.orders as { id: string }).id);
  const { data: cash } = ids.length ? await db.from("cash_confirmations").select("order_id").in("order_id", ids) : { data: [] };
  const cashDone = new Set((cash ?? []).map((c) => c.order_id));
  const proposed = (missions ?? []).filter((m) => m.status === "proposed");
  const current = (missions ?? []).filter((m) => ["accepted", "picked_up", "arrived"].includes(m.status) || (m.status === "delivered" && !cashDone.has((m.orders as { id: string }).id) && (m.orders as { payment_method: string }).payment_method === "cash"));
  const past = (missions ?? []).filter((m) => !proposed.includes(m) && !current.includes(m));

  return (
    <>
      <Banner
        tone="violet"
        crumbs={[{ label: "Espace livreur" }]}
        title="Vos missions"
        highlight="du jour."
        text="Acceptez une livraison, consultez l'adresse, confirmez la remise et l'encaissement en espèces."
        illustration="map"
      >
        <BannerChips
          dark
          items={[
            { label: "Missions", href: "#proposees" },
            { label: "En cours", href: "#en-cours" },
            { label: "Encaissements", href: "/livreur/remunerations#encaissements" },
            { label: "Rémunérations", href: "/livreur/remunerations" },
          ]}
        />
      </Banner>
      <div className="container-dg mt-8 space-y-8">
        <Flash searchParams={props.searchParams} />
        {!courier ? (
          <Empty>Aucun profil livreur n&apos;est associé à ce compte ({profile.email}).</Empty>
        ) : courier.status !== "active" ? (
          <p className="rounded-xl bg-peach px-4 py-3 text-sm font-semibold text-orange-700">
            Votre profil est {courier.status === "pending" ? "en attente de validation par DineGo" : "suspendu"}. Vous recevrez une notification dès son activation.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <form action={toggleAvailability}>
              <SubmitButton className={courier.available ? "btn-outline" : "btn-primary"}>{courier.available ? "Me rendre indisponible" : "Me rendre disponible"}</SubmitButton>
            </form>
            <span className="text-sm text-muted">
              {courier.network === "dinego" ? "Réseau central DineGo" : "Livreur du restaurant"} · {courier.zones?.name ?? "zone non définie"} ·{" "}
              <strong>{courier.available ? "disponible" : "indisponible"}</strong>
            </span>
          </div>
        )}

        <section id="proposees" className="scroll-mt-20 space-y-3">
          <h2 className="h2">Missions proposées</h2>
          {proposed.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {proposed.map((m) => {
                const o = m.orders as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
                return (
                  <div key={m.id} className="card space-y-2 text-sm">
                    <p className="font-extrabold text-violet">{o.code} · {o.restaurants?.name}</p>
                    <p>Retrait : {o.restaurants?.address}</p>
                    <p>Livraison : {o.address}</p>
                    <p>{fcfa(o.total)} · {PAYMENT_METHOD[o.payment_method]}{o.payment_method === "cash" ? " (à encaisser)" : ""}</p>
                    <div className="flex flex-wrap gap-2">
                      <form action={acceptMission}>
                        <input type="hidden" name="mission_id" value={m.id} />
                        <SubmitButton className="btn-primary btn-sm">Accepter</SubmitButton>
                      </form>
                      <form action={refuseMission} className="flex gap-2">
                        <input type="hidden" name="mission_id" value={m.id} />
                        <input name="reason" placeholder="Motif (facultatif)" aria-label="Motif du refus" className="input w-40 py-1.5" />
                        <SubmitButton className="btn-ghost btn-sm">Refuser</SubmitButton>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty>Aucune nouvelle mission.</Empty>
          )}
        </section>

        <section id="en-cours" className="scroll-mt-20 space-y-3">
          <h2 className="h2">En cours</h2>
          {current.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {current.map((m) => {
                const o = m.orders as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
                const needsCash = o.payment_method === "cash" && !cashDone.has(o.id);
                return (
                  <div key={m.id} className="card space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-extrabold text-violet">{o.code}</p>
                      <StatusBadge status={m.status === "delivered" ? "handed_over" : "delivering"} label={MISSION_STATUS[m.status]} />
                    </div>
                    <p>
                      <strong>Restaurant :</strong> {o.restaurants?.name} — {o.restaurants?.address} (<a className="underline" href={`tel:${o.restaurants?.phone}`}>{o.restaurants?.phone}</a>)
                    </p>
                    <p>
                      <strong>Client :</strong> {o.profiles?.full_name} — <a className="underline" href={`tel:${o.contact_phone}`}>{o.contact_phone}</a>
                    </p>
                    <p><strong>Adresse :</strong> {o.address}</p>
                    {o.notes && <p className="rounded-lg bg-cream px-2 py-1 text-xs">Note : {o.notes}</p>}
                    <p>
                      <strong>À encaisser :</strong> {o.payment_method === "cash" ? fcfa(o.total) + " en espèces" : "rien (paiement numérique)"}
                    </p>
                    <div className="flex flex-wrap gap-2 border-t border-line pt-2">
                      {m.status === "accepted" && <Step id={m.id} step="picked_up" label="Commande récupérée" />}
                      {m.status === "picked_up" && <Step id={m.id} step="arrived" label="Je suis arrivé" />}
                      {["picked_up", "arrived"].includes(m.status) && <Step id={m.id} step="delivered" label="Remise au client" primary />}
                      {needsCash && ["delivering", "handed_over"].includes(o.status) && (
                        <form action={courierConfirmCash} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream p-2">
                          <input type="hidden" name="mission_id" value={m.id} />
                          <label className="text-xs font-bold text-violet" htmlFor={`c-${m.id}`}>Espèces reçues</label>
                          <input id={`c-${m.id}`} name="amount" type="number" min={1} defaultValue={o.total} className="input w-28 py-1.5" />
                          <SubmitButton className="btn-primary btn-sm" confirm="Confirmer avoir reçu cette somme ?">Confirmer l&apos;encaissement</SubmitButton>
                        </form>
                      )}
                    </div>
                    <details className="text-xs">
                      <summary className="cursor-pointer font-semibold text-violet">Signaler un incident</summary>
                      <form action={courierIncident} className="mt-2 flex flex-wrap gap-2">
                        <input type="hidden" name="mission_id" value={m.id} />
                        <select name="type" className="input w-44 py-1.5" aria-label="Type d'incident">
                          <option value="autre">Retard / autre</option>
                          <option value="non_livree">Commande non livrée</option>
                        </select>
                        <input name="reason" required placeholder="Description" aria-label="Description" className="input w-48 py-1.5" />
                        <SubmitButton className="btn-danger btn-sm">Signaler</SubmitButton>
                      </form>
                    </details>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty>Aucune livraison en cours.</Empty>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="h2">Livraisons effectuées et historique</h2>
          {past.length ? (
            <div className="card overflow-x-auto p-0">
              <table className="table-dg">
                <thead><tr><th>Date</th><th>Commande</th><th>Restaurant</th><th>Statut</th></tr></thead>
                <tbody>
                  {past.map((m) => {
                    const o = m.orders as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
                    return (
                      <tr key={m.id}>
                        <td>{dateTime(m.updated_at)}</td>
                        <td>{o.code}</td>
                        <td>{o.restaurants?.name}</td>
                        <td>{MISSION_STATUS[m.status]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Pas encore d&apos;historique.</Empty>
          )}
        </section>
      </div>
    </>
  );
}

function Step({ id, step, label, primary }: { id: string; step: string; label: string; primary?: boolean }) {
  return (
    <form action={missionStep}>
      <input type="hidden" name="mission_id" value={id} />
      <input type="hidden" name="step" value={step} />
      <SubmitButton className={primary ? "btn-primary btn-sm" : "btn-violet btn-sm"}>{label}</SubmitButton>
    </form>
  );
}
