"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { lineTotal, useCart } from "@/components/cart";
import { SubmitButton } from "@/components/SubmitButton";
import { placeOrder, quoteOrder } from "@/app/actions/orders";
import { PAYMENT_METHOD, fcfa } from "@/lib/format";

type Address = { id: string; label: string; city: string; zone: string | null; details: string };
type Zone = { id: string; city: string; name: string };
type Quote = Awaited<ReturnType<typeof quoteOrder>>;

export function CheckoutForm({ addresses, zones, defaultPhone }: { addresses: Address[]; zones: Zone[]; defaultPhone: string }) {
  const { cart, ready } = useCart();
  const [mode, setMode] = useState<"delivery" | "pickup">("delivery");
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "new");
  const [zoneId, setZoneId] = useState("");
  const [method, setMethod] = useState("orange_money");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pending, start] = useTransition();

  const cartInput = cart.restaurant
    ? {
        restaurant_id: cart.restaurant.id,
        items: cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, options: i.options.map((o) => ({ name: o.name })) })),
      }
    : null;
  const cartJson = JSON.stringify(cartInput);

  // Devis recalculé par le serveur à chaque changement (prix, promotions, frais)
  useEffect(() => {
    if (!ready || !cartInput) return;
    start(async () => {
      setQuote(await quoteOrder(JSON.parse(cartJson), mode, mode === "delivery" ? zoneId || null : null));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cartJson, mode, zoneId]);

  if (!ready) return <p className="text-sm text-muted">Chargement…</p>;
  if (!cart.restaurant || !cart.items.length)
    return (
      <div className="card text-center">
        <p className="mb-4 text-muted">Votre panier est vide.</p>
        <Link href="/restaurants" className="btn-primary">Découvrir les restaurants</Link>
      </div>
    );

  const r = quote && "restaurant" in quote ? quote.restaurant : null;

  return (
    <form action={placeOrder} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <input type="hidden" name="cart" value={cartJson} />
      <div className="space-y-6">
        <fieldset className="card space-y-3">
          <legend className="h3 mb-1 text-lg">Livraison ou retrait</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["delivery", "pickup"] as const).map((m) => {
              const disabled = r ? (m === "delivery" ? !r.offers_delivery : !r.offers_pickup) : false;
              return (
                <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-all ${mode === m ? "border-orange bg-cream shadow-[var(--shadow-soft)]" : "border-line bg-white hover:border-lilac-300"} ${disabled ? "opacity-50" : ""}`}>
                  <input type="radio" name="mode" value={m} checked={mode === m} disabled={disabled} onChange={() => setMode(m)} />
                  <span>
                    <span className="block font-bold text-violet">{m === "delivery" ? "🛵 Livraison" : "🏪 Retrait sur place"}</span>
                    <span className="text-xs text-muted">{m === "delivery" ? "Livrée à votre adresse" : "À récupérer au restaurant, sans frais de livraison"}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {mode === "delivery" && (
          <fieldset className="card space-y-3">
            <legend className="h3 mb-1 text-lg">Adresse de livraison</legend>
            {addresses.map((a) => (
              <label key={a.id} className="flex items-start gap-2 text-sm">
                <input type="radio" name="address_id" value={a.id} checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                <span>
                  <strong>{a.label}</strong> — {a.details}, {a.zone ? `${a.zone}, ` : ""}
                  {a.city}
                </span>
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="address_id" value="new" checked={addressId === "new"} onChange={() => setAddressId("new")} />
              Nouvelle adresse
            </label>
            <div>
              <label className="label" htmlFor="zone_id">Quartier / zone</label>
              <select id="zone_id" name="zone_id" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="input">
                <option value="">— Choisir —</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name} ({z.city})</option>
                ))}
              </select>
            </div>
            {addressId === "new" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="new_city">Ville</label>
                  <input id="new_city" name="new_city" className="input" defaultValue={zones.find((z) => z.id === zoneId)?.city ?? "Ouagadougou"} required />
                </div>
                <div>
                  <label className="label" htmlFor="new_details">Adresse précise / repères</label>
                  <input id="new_details" name="new_details" className="input" placeholder="Rue, porte, repère…" required />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" name="save_address" defaultChecked /> Enregistrer cette adresse
                </label>
              </div>
            )}
          </fieldset>
        )}

        <fieldset className="card space-y-3">
          <legend className="h3 mb-1 text-lg">Contact et instructions</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="contact_phone">Téléphone</label>
              <input id="contact_phone" name="contact_phone" type="tel" defaultValue={defaultPhone} required className="input" />
            </div>
            {r?.accepts_scheduled && (
              <div>
                <label className="label" htmlFor="scheduled_for">Programmer pour (facultatif)</label>
                <input id="scheduled_for" name="scheduled_for" type="datetime-local" className="input" />
              </div>
            )}
          </div>
          <div>
            <label className="label" htmlFor="notes">Instructions (facultatif)</label>
            <textarea id="notes" name="notes" rows={2} className="input" placeholder="Sans piment, sonner au portail…" />
          </div>
        </fieldset>

        <fieldset className="card space-y-2">
          <legend className="h3 mb-1 text-lg">Moyen de paiement</legend>
          {Object.entries(PAYMENT_METHOD).map(([k, label]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-sm transition-all ${method === k ? "border-orange bg-cream shadow-[var(--shadow-soft)]" : "border-line bg-white hover:border-lilac-300"}`}>
              <input type="radio" name="payment_method" value={k} checked={method === k} onChange={() => setMethod(k)} />
              <span className="font-semibold">
                {k === "cash" ? (mode === "delivery" ? "Espèces à la livraison" : "Espèces au retrait") : label}
              </span>
            </label>
          ))}
          {method !== "cash" && (
            <p className="text-xs text-muted">
              Après validation, vous effectuerez le paiement puis indiquerez la référence de transaction. Il sera confirmé après vérification auprès de l&apos;opérateur.
            </p>
          )}
        </fieldset>
      </div>

      <aside className="card h-fit space-y-4 lg:sticky lg:top-24">
        <h2 className="h3">{cart.restaurant.name}</h2>
        <ul className="space-y-1 text-sm">
          {cart.items.map((i) => (
            <li key={i.key} className="flex justify-between gap-2">
              <span>
                {i.quantity} × {i.name}
                {i.options.length ? <span className="text-xs text-muted"> ({i.options.map((o) => o.name).join(", ")})</span> : null}
              </span>
              <span className="whitespace-nowrap">{fcfa(lineTotal(i))}</span>
            </li>
          ))}
        </ul>
        {quote && "subtotal" in quote ? (
          <dl className="space-y-1 border-t border-line pt-3 text-sm">
            <Row label="Montant des produits" v={quote.subtotal} />
            {quote.discount > 0 && <Row label="Réductions" v={-quote.discount} accent />}
            {mode === "delivery" && <Row label="Frais de livraison" v={quote.deliveryFee} />}
            {quote.managementFee > 0 && <Row label="Frais de service" v={quote.managementFee} />}
            <div className="flex justify-between border-t border-line pt-2 text-base">
              <dt className="font-extrabold text-violet">Total à payer</dt>
              <dd className="price text-lg">{fcfa(quote.total)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted">{pending ? "Calcul du total…" : ""}</p>
        )}
        {quote && !quote.ok && (
          <ul className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800" role="alert">
            {quote.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {quote && "open" in quote && quote.open === false && (
          <p className="rounded-xl bg-peach p-3 text-xs font-semibold text-orange-700">Le restaurant est fermé actuellement{r?.accepts_scheduled ? " : programmez votre commande." : "."}</p>
        )}
        <SubmitButton className="btn-primary w-full">Confirmer la commande</SubmitButton>
        <Link href="/panier" className="btn-ghost w-full">Modifier le panier</Link>
      </aside>
    </form>
  );
}

function Row({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${accent ? "text-green-700" : ""}`}>
      <dt>{label}</dt>
      <dd className="font-semibold">{fcfa(v)}</dd>
    </div>
  );
}
