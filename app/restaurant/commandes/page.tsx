import type { Metadata } from "next";
import Link from "next/link";
import { requireMyRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import {
  acceptOrder,
  advanceOrder,
  assignCourier,
  cancelByRestaurant,
  refuseOrder,
  reportNotDelivered,
  restaurantConfirmCash,
  restaurantVerifyPayment,
} from "@/app/actions/restaurant";
import { DIGITAL_METHODS, MISSION_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Commandes" };

const ACTIVE = ["sent", "received", "accepted", "preparing", "ready", "awaiting_pickup", "delivering", "handed_over"];

export default async function RestaurantOrders(props: PageProps<"/restaurant/commandes">) {
  const { restaurant } = await requireMyRestaurant();
  const sp = await props.searchParams;
  const tab = sp.tab === "terminees" ? "terminees" : "actives";
  const db = createAdminClient();
  let q = db
    .from("orders")
    .select("*, order_items(name, quantity, options, line_total), order_financials(collector), profiles!orders_client_id_fkey(full_name)")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: tab === "actives" });
  q = tab === "actives" ? q.in("status", ACTIVE) : q.not("status", "in", `(${ACTIVE.join(",")})`).limit(100);
  const [{ data: orders }, { data: couriers }] = await Promise.all([
    q,
    db.from("couriers").select("id, full_name, user_id, status").eq("restaurant_id", restaurant.id).eq("status", "active"),
  ]);
  const ids = (orders ?? []).map((o) => o.id);
  const [{ data: missions }, { data: assigned }, { data: cash }] = await Promise.all([
    ids.length ? db.from("delivery_missions").select("order_id, status, couriers(full_name, network)").in("order_id", ids).neq("status", "cancelled") : { data: [] },
    db.from("couriers").select("id, full_name, phone, network, user_id"),
    ids.length ? db.from("cash_confirmations").select("order_id, amount").in("order_id", ids) : { data: [] },
  ]);
  const courierById = new Map((assigned ?? []).map((c) => [c.id, c]));

  return (
    <div className="container-dg mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Commandes</h1>
        <div className="flex gap-1">
          <Link href="/restaurant/commandes" className={tab === "actives" ? "btn-violet btn-sm" : "btn-ghost btn-sm"}>En cours</Link>
          <Link href="/restaurant/commandes?tab=terminees" className={tab === "terminees" ? "btn-violet btn-sm" : "btn-ghost btn-sm"}>Historique</Link>
        </div>
      </div>
      <Flash searchParams={props.searchParams} />
      {!orders?.length && <Empty>{tab === "actives" ? "Aucune commande en cours." : "Aucune commande dans l'historique."}</Empty>}
      <div className="grid gap-4 xl:grid-cols-2">
        {orders?.map((o) => {
          const courier = o.courier_id ? courierById.get(o.courier_id) : null;
          const restaurantDrives = courier?.network === "restaurant" && !courier.user_id;
          const orderMissions = (missions ?? []).filter((m) => m.order_id === o.id);
          const collector = (o.order_financials as unknown as { collector: string } | null)?.collector;
          const cashDone = (cash ?? []).find((c) => c.order_id === o.id);
          const canConfirmCash = o.payment_method === "cash" && o.payment_status === "pending" && !cashDone && (o.mode === "pickup" || restaurantDrives) && ["awaiting_pickup", "delivering", "handed_over"].includes(o.status);
          const canVerify = DIGITAL_METHODS.includes(o.payment_method) && o.payment_status === "pending" && collector === "restaurant";
          const client = o.profiles as unknown as { full_name: string } | null;
          return (
            <article key={o.id} className="card space-y-3">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold text-violet">{o.code}</p>
                  <p className="text-xs text-muted">
                    {dateTime(o.created_at)} · {client?.full_name} · <a href={`tel:${o.contact_phone}`} className="underline">{o.contact_phone}</a>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className={`badge ${o.mode === "delivery" ? "bg-violet text-white" : "bg-peach text-orange-700"}`}>{o.mode === "delivery" ? "Livraison" : "Retrait"}</span>
                  <StatusBadge status={o.status} />
                </div>
              </header>
              {o.scheduled_for && <p className="rounded-lg bg-lilac px-3 py-1 text-xs font-bold text-violet">Programmée pour le {dateTime(o.scheduled_for)}</p>}
              <ul className="text-sm">
                {(o.order_items as { name: string; quantity: number; options: { name: string }[]; line_total: number }[]).map((i, k) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span>
                      <strong>{i.quantity} ×</strong> {i.name}
                      {i.options?.length ? <span className="text-xs text-muted"> ({i.options.map((x) => x.name).join(", ")})</span> : null}
                    </span>
                    <span>{fcfa(i.line_total)}</span>
                  </li>
                ))}
              </ul>
              {o.notes && <p className="rounded-lg bg-cream px-3 py-2 text-xs">Note du client : {o.notes}</p>}
              <p className="text-sm">
                Total <strong>{fcfa(o.total)}</strong> · {PAYMENT_METHOD[o.payment_method]} · <StatusBadge status={o.payment_status} label={PAYMENT_STATUS[o.payment_status]} />
              </p>
              {o.mode === "delivery" && <p className="text-xs text-muted">Adresse : {o.address}</p>}
              {courier && <p className="text-xs">Livreur : <strong>{courier.full_name}</strong> ({courier.network === "dinego" ? "réseau DineGo" : "livreur du restaurant"})</p>}
              {!courier && orderMissions.length > 0 && (
                <p className="text-xs text-muted">Missions : {orderMissions.map((m) => `${(m.couriers as unknown as { full_name: string })?.full_name} (${MISSION_STATUS[m.status]})`).join(", ")}</p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                {["sent", "received"].includes(o.status) && (
                  <>
                    <form action={acceptOrder} className="flex items-center gap-2">
                      <input type="hidden" name="order_id" value={o.id} />
                      <label className="text-xs" htmlFor={`prep-${o.id}`}>Délai (min)</label>
                      <input id={`prep-${o.id}`} name="prep_minutes" type="number" min={5} max={240} defaultValue={20} className="input w-20 py-1.5" />
                      <SubmitButton className="btn-primary btn-sm">Accepter</SubmitButton>
                    </form>
                    <form action={refuseOrder} className="flex items-center gap-2">
                      <input type="hidden" name="order_id" value={o.id} />
                      <input name="reason" required placeholder="Motif du refus" aria-label="Motif du refus" className="input w-40 py-1.5" />
                      <SubmitButton className="btn-danger btn-sm">Refuser</SubmitButton>
                    </form>
                  </>
                )}
                {o.status === "accepted" && <Step id={o.id} step="preparing" label="Démarrer la préparation" />}
                {["accepted", "preparing"].includes(o.status) && <Step id={o.id} step="ready" label="Commande prête" primary />}
                {o.mode === "pickup" && o.status === "awaiting_pickup" && <Step id={o.id} step="handed_over" label="Remise au client" primary />}
                {restaurantDrives && o.status === "awaiting_pickup" && <Step id={o.id} step="delivering" label="Partie en livraison" primary />}
                {restaurantDrives && o.status === "delivering" && <Step id={o.id} step="handed_over" label="Remise au client" primary />}

                {o.mode === "delivery" && !o.courier_id && ["accepted", "preparing", "ready", "awaiting_pickup"].includes(o.status) && (
                  <form action={assignCourier} className="flex items-center gap-2">
                    <input type="hidden" name="order_id" value={o.id} />
                    <select name="courier_id" className="input py-1.5" aria-label="Livreur">
                      {couriers?.map((c) => <option key={c.id} value={c.id}>{c.full_name}{c.user_id ? "" : " (géré par le restaurant)"}</option>)}
                      <option value="network">Solliciter le réseau DineGo</option>
                    </select>
                    <SubmitButton className="btn-violet btn-sm">Affecter</SubmitButton>
                  </form>
                )}

                {canConfirmCash && (
                  <form action={restaurantConfirmCash} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream p-2">
                    <input type="hidden" name="order_id" value={o.id} />
                    <label className="text-xs font-bold text-violet" htmlFor={`cash-${o.id}`}>Espèces reçues</label>
                    <input id={`cash-${o.id}`} name="amount" type="number" min={1} defaultValue={o.total} className="input w-28 py-1.5" />
                    <input name="reference" placeholder="Réf. (facultatif)" aria-label="Référence" className="input w-32 py-1.5" />
                    <SubmitButton className="btn-primary btn-sm" confirm="Confirmer avoir reçu cette somme en espèces ?">Confirmer l&apos;encaissement</SubmitButton>
                  </form>
                )}
                {cashDone && <span className="badge bg-green-100 text-green-900">Encaissement confirmé : {fcfa(cashDone.amount)}</span>}
                {canVerify && (
                  <form action={restaurantVerifyPayment} className="flex flex-wrap items-center gap-2 rounded-xl bg-lilac/60 p-2">
                    <input type="hidden" name="order_id" value={o.id} />
                    <input type="hidden" name="back" value="/restaurant/commandes" />
                    <input name="provider_reference" placeholder="Réf. opérateur vérifiée" aria-label="Référence opérateur" className="input w-40 py-1.5" />
                    <SubmitButton className="btn-primary btn-sm" name="decision" value="confirm">Paiement reçu</SubmitButton>
                    <SubmitButton className="btn-ghost btn-sm" name="decision" value="fail">Non reçu</SubmitButton>
                  </form>
                )}
                {o.mode === "delivery" && ["delivering", "awaiting_pickup"].includes(o.status) && (
                  <details className="w-full text-xs">
                    <summary className="cursor-pointer font-semibold text-violet">Signaler une commande non livrée</summary>
                    <form action={reportNotDelivered} className="mt-2 flex gap-2">
                      <input type="hidden" name="order_id" value={o.id} />
                      <input name="reason" required placeholder="Motif" aria-label="Motif" className="input py-1.5" />
                      <SubmitButton className="btn-danger btn-sm">Signaler</SubmitButton>
                    </form>
                  </details>
                )}
                {["accepted", "preparing", "ready", "awaiting_pickup"].includes(o.status) && (
                  <details className="w-full text-xs">
                    <summary className="cursor-pointer font-semibold text-muted">Annuler la commande</summary>
                    <form action={cancelByRestaurant} className="mt-2 flex gap-2">
                      <input type="hidden" name="order_id" value={o.id} />
                      <input name="reason" required placeholder="Motif" aria-label="Motif d'annulation" className="input py-1.5" />
                      <SubmitButton className="btn-danger btn-sm" confirm="Annuler cette commande ?">Annuler</SubmitButton>
                    </form>
                  </details>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Step({ id, step, label, primary }: { id: string; step: string; label: string; primary?: boolean }) {
  return (
    <form action={advanceOrder}>
      <input type="hidden" name="order_id" value={id} />
      <input type="hidden" name="step" value={step} />
      <SubmitButton className={primary ? "btn-primary btn-sm" : "btn-violet btn-sm"}>{label}</SubmitButton>
    </form>
  );
}
