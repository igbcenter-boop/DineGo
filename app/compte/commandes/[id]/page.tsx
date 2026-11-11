import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Banner } from "@/components/Banner";
import { ClearCart } from "@/components/ClearCart";
import { Flash, OrderTimeline, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { cancelOrderByClient, submitComplaint, submitPaymentReference, submitReview } from "@/app/actions/orders";
import { COMPLAINT_TYPES, DIGITAL_METHODS, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, REFUND_STATUS, TICKET_STATUS, dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Suivi de commande" };

const HEADLINE: Record<string, [string, string]> = {
  sent: ["Votre commande est", "envoyée !"],
  received: ["Votre commande est", "bien reçue."],
  accepted: ["Votre commande est", "acceptée !"],
  preparing: ["Votre commande est", "en préparation."],
  ready: ["Votre commande est", "prête !"],
  awaiting_pickup: ["Votre commande vous", "attend au comptoir."],
  delivering: ["Votre commande est", "en route !"],
  handed_over: ["Votre commande vous a été", "remise."],
  completed: ["Commande terminée,", "bon appétit !"],
  refused: ["Votre commande a été", "refusée."],
  cancelled: ["Votre commande a été", "annulée."],
  not_delivered: ["Votre commande n'a pas pu", "être livrée."],
};

function MiniTracker({ status, mode }: { status: string; mode: string }) {
  const steps = mode === "delivery" ? ["Reçue", "Préparée", "En route", "Livrée"] : ["Reçue", "Préparée", "Prête", "Retirée"];
  const order = ["sent", "received", "accepted", "preparing", "ready", "awaiting_pickup", "delivering", "handed_over", "completed"];
  const pos = order.indexOf(status);
  const active = pos < 0 ? -1 : pos <= 3 ? 0 : pos <= 4 ? 1 : pos <= 6 ? 2 : 3;
  return (
    <ol className="flex items-start gap-2 text-white" aria-label="Avancement">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-col items-center gap-2 text-xs">
          <span className={`grid h-10 w-10 place-items-center rounded-full border-4 ${i < active ? "border-orange bg-orange" : i === active ? "border-white bg-white" : "border-white/60"}`}>
            {i < active ? "✓" : i === active ? <span className="h-3 w-3 rounded-full bg-orange" /> : ""}
          </span>
          <span className={i === active ? "font-bold text-orange" : ""}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function ClientOrderPage(props: PageProps<"/compte/commandes/[id]">) {
  const profile = await requireRole("client");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: o } = await supabase.from("orders").select("*, restaurants(name, slug, phone)").eq("id", id).eq("client_id", profile.id).maybeSingle();
  if (!o) notFound();
  const db = createAdminClient();
  const [{ data: items }, { data: history }, { data: payment }, { data: review }, { data: complaints }, { data: refunds }, courierRes] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at"),
    supabase.from("payments").select("*").eq("order_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("reviews").select("id").eq("order_id", id).maybeSingle(),
    supabase.from("complaints").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("refunds").select("*").eq("order_id", id),
    o.courier_id ? db.from("couriers").select("full_name, phone").eq("id", o.courier_id).single() : Promise.resolve({ data: null }),
  ]);
  const courier = courierRes.data as { full_name: string; phone: string } | null;
  const [t, h] = HEADLINE[o.status] ?? ["Votre commande", ""];
  const path = `/compte/commandes/${id}`;
  const digital = DIGITAL_METHODS.includes(o.payment_method);

  return (
    <>
      {sp.placed === "1" && <ClearCart />}
      <Banner
        tone="violet"
        crumbs={[{ label: "Mes commandes", href: "/compte" }, { label: "Suivi" }]}
        title={t}
        highlight={h}
        text="Suivez chaque étape en temps réel, de la cuisine du restaurant jusqu'à votre porte."
        aside={<MiniTracker status={o.status} mode={o.mode} />}
      >
        {courier && o.status === "delivering" && (
          <a href={`tel:${courier.phone}`} className="btn-primary">
            Contacter le livreur
          </a>
        )}
        <a href="#reclamation" className="btn-outline-light">
          Signaler un problème
        </a>
      </Banner>

      <div className="container-dg mt-8 space-y-6">
        <Flash searchParams={props.searchParams} />
        {sp.placed === "1" && (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            Commande {o.code} envoyée au restaurant. Vous recevrez une notification à chaque étape.
          </p>
        )}

        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="h2">
              {o.code} · {(o.restaurants as unknown as { name: string })?.name}
            </h2>
            <StatusBadge status={o.status} />
          </div>
          <OrderTimeline status={o.status} mode={o.mode} />
          {o.prep_minutes && ["accepted", "preparing"].includes(o.status) && <p className="text-sm text-muted">Délai de préparation annoncé : {o.prep_minutes} min.</p>}
          {o.scheduled_for && <p className="text-sm font-semibold text-violet">Commande programmée pour le {dateTime(o.scheduled_for)}.</p>}
          {o.refuse_reason && <p className="text-sm text-red-700">Motif du refus : {o.refuse_reason}</p>}
          {o.cancel_reason && <p className="text-sm text-red-700">Motif d&apos;annulation : {o.cancel_reason}</p>}
          {courier && <p className="text-sm">Livreur : <strong>{courier.full_name}</strong></p>}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="h3 mb-3">Détail</h2>
            <ul className="space-y-1 text-sm">
              {items?.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span>
                    {i.quantity} × {i.name}
                    {i.options?.length ? <span className="text-xs text-muted"> ({i.options.map((x: { name: string }) => x.name).join(", ")})</span> : null}
                  </span>
                  <span>{fcfa(i.line_total)}</span>
                </li>
              ))}
            </ul>
            {/* Le client ne voit que les montants qui le concernent, jamais la ventilation interne (§7.3) */}
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>Produits</dt><dd>{fcfa(o.subtotal)}</dd></div>
              {o.discount > 0 && <div className="flex justify-between text-green-700"><dt>Réductions</dt><dd>-{fcfa(o.discount)}</dd></div>}
              {o.delivery_fee > 0 && <div className="flex justify-between"><dt>Livraison</dt><dd>{fcfa(o.delivery_fee)}</dd></div>}
              {o.management_fee > 0 && <div className="flex justify-between"><dt>Frais de service</dt><dd>{fcfa(o.management_fee)}</dd></div>}
              <div className="flex justify-between text-base"><dt className="font-extrabold text-violet">Total</dt><dd className="price">{fcfa(o.total)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              {o.mode === "delivery" ? `Livraison : ${o.address}` : "Retrait au restaurant"} · Tél. {o.contact_phone}
            </p>
          </section>

          <section className="card space-y-3">
            <h2 className="h3">Paiement</h2>
            <p className="text-sm">
              {PAYMENT_METHOD[o.payment_method]} · <StatusBadge status={o.payment_status} label={PAYMENT_STATUS[o.payment_status]} />
            </p>
            {digital && o.payment_status === "pending" && !["cancelled", "refused"].includes(o.status) && (
              <form action={submitPaymentReference} className="space-y-2 rounded-xl bg-cream p-3 text-sm">
                <input type="hidden" name="order_id" value={o.id} />
                <p>
                  Effectuez le paiement de <strong>{fcfa(o.total)}</strong> via {PAYMENT_METHOD[o.payment_method]}, puis saisissez la référence reçue par SMS.
                </p>
                {payment?.reference && <p className="text-xs text-muted">Référence transmise : {payment.reference} (vérification en cours)</p>}
                <div className="flex gap-2">
                  <input name="reference" required minLength={4} placeholder="Référence de transaction" aria-label="Référence de transaction" className="input" />
                  <SubmitButton className="btn-primary">Envoyer</SubmitButton>
                </div>
              </form>
            )}
            {o.payment_method === "cash" && o.payment_status === "pending" && (
              <p className="text-xs text-muted">Vous réglerez {fcfa(o.total)} en espèces {o.mode === "delivery" ? "au livreur" : "au restaurant"}. L&apos;encaissement sera confirmé dans l&apos;application.</p>
            )}
            {refunds?.map((r) => (
              <p key={r.id} className="text-sm">
                Remboursement {fcfa(r.amount)} : <StatusBadge status={r.status} label={REFUND_STATUS[r.status]} />
              </p>
            ))}
            {["sent", "received"].includes(o.status) && (
              <form action={cancelOrderByClient} className="space-y-2 border-t border-line pt-3">
                <input type="hidden" name="order_id" value={o.id} />
                <input name="reason" placeholder="Motif (facultatif)" aria-label="Motif d'annulation" className="input" />
                <SubmitButton className="btn-danger btn-sm" confirm="Annuler cette commande ?">Annuler la commande</SubmitButton>
              </form>
            )}
          </section>
        </div>

        {o.status === "completed" && !review && (
          <form action={submitReview} className="card grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="order_id" value={o.id} />
            <p className="h3 sm:col-span-3">Évaluer votre commande</p>
            <label className="text-sm">
              <span className="label">Restaurant et repas</span>
              <select name="rating_restaurant" className="input" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n}/5)</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="label">Qualité du service</span>
              <select name="rating_service" className="input" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n}/5)</option>)}
              </select>
            </label>
            <label className="text-sm sm:col-span-3">
              <span className="label">Commentaire</span>
              <textarea name="comment" rows={2} className="input" />
            </label>
            <SubmitButton className="btn-primary sm:w-fit">Publier mon avis</SubmitButton>
          </form>
        )}

        <section id="reclamation" className="grid scroll-mt-20 gap-6 lg:grid-cols-2">
          <form action={submitComplaint} className="card space-y-3">
            <input type="hidden" name="order_id" value={o.id} />
            <input type="hidden" name="back" value={path} />
            <p className="h3">Signaler un problème</p>
            <select name="type" className="input" aria-label="Type de problème">
              {Object.entries(COMPLAINT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <textarea name="description" required minLength={5} rows={3} placeholder="Décrivez le problème" aria-label="Description" className="input" />
            <SubmitButton className="btn-primary">Envoyer la réclamation</SubmitButton>
          </form>
          <div className="card space-y-3">
            <p className="h3">Historique</p>
            <ul className="space-y-1 text-sm">
              {history?.map((hst) => (
                <li key={hst.id}>
                  <span className="text-muted">{dateTime(hst.created_at)}</span> — {ORDER_STATUS[hst.status]}
                  {hst.note ? ` (${hst.note})` : ""}
                </li>
              ))}
            </ul>
            {!!complaints?.length && (
              <>
                <p className="h3 pt-2">Mes réclamations</p>
                <ul className="space-y-2 text-sm">
                  {complaints.map((c) => (
                    <li key={c.id} className="rounded-xl bg-lilac/50 p-3">
                      <p className="font-semibold">{COMPLAINT_TYPES[c.type]} · <StatusBadge status={c.status} label={TICKET_STATUS[c.status]} /></p>
                      <p>{c.description}</p>
                      {c.response && <p className="mt-1 text-violet">Réponse DineGo : {c.response}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
        <Link href="/compte" className="btn-ghost">← Retour à mes commandes</Link>
      </div>
    </>
  );
}
