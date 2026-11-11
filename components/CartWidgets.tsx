"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { lineTotal, useCart, type CartOption } from "@/components/cart";
import { fcfa } from "@/lib/format";

export function CartBadge({ dark = false }: { dark?: boolean }) {
  const { count } = useCart();
  return (
    <Link href="/panier" className={`relative inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold ${dark ? "text-white hover:bg-white/10" : "text-violet hover:bg-lilac"}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 7h12l-1 13H7z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      <span className="hidden sm:inline">Panier</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-orange px-1 text-[11px] font-extrabold text-violet-700">
          {count}
        </span>
      )}
    </Link>
  );
}

type ProductLite = {
  id: string;
  name: string;
  price: number;
  options: CartOption[];
};

/** Ajout d'un plat au panier, avec ses options / suppléments. */
export function AddToCart({
  restaurant,
  product,
  disabled,
}: {
  restaurant: { id: string; name: string; slug: string };
  product: ProductLite;
  disabled?: boolean;
}) {
  const { add, cart } = useCart();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [chosen, setChosen] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const options = product.options.filter((o) => chosen.includes(o.name));
  const total = lineTotal({ unit_price: product.price, quantity: qty, options });

  function submit(replace = false) {
    const res = add(restaurant, { product_id: product.id, name: product.name, unit_price: product.price, quantity: qty, options }, replace);
    if (res === "conflict") {
      setConflict(true);
      return;
    }
    setMessage("Ajouté au panier ✓");
    setOpen(false);
    setQty(1);
    setChosen([]);
    setTimeout(() => setMessage(null), 2000);
  }

  if (disabled) return <span className="text-xs font-semibold text-muted">Indisponible</span>;

  if (conflict) {
    return (
      <div className="rounded-xl bg-cream p-3 text-xs" role="alert">
        <p className="mb-2 font-semibold text-violet">
          Une commande ne peut concerner qu&apos;un seul restaurant. Votre panier contient déjà des plats de « {cart.restaurant?.name} ».
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary btn-sm"
            onClick={() => {
              setConflict(false);
              submit(true);
            }}
          >
            Vider et ajouter
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setConflict(false)}>
            Garder mon panier
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button className="btn-primary btn-sm" onClick={() => (product.options.length ? setOpen(true) : submit())}>
          + Ajouter
        </button>
        {message && <span className="text-xs font-semibold text-green-700">{message}</span>}
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl bg-lilac/60 p-3 text-sm">
      <p className="mb-2 font-bold text-violet">Options et suppléments</p>
      {product.options.map((o) => (
        <label key={o.name} className="flex items-center justify-between gap-2 py-1">
          <span className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={chosen.includes(o.name)}
              onChange={(e) => setChosen((c) => (e.target.checked ? [...c, o.name] : c.filter((x) => x !== o.name)))}
            />
            {o.name}
          </span>
          <span className="text-xs text-muted">+{fcfa(o.price)}</span>
        </label>
      ))}
      <div className="mt-2 flex items-center justify-between gap-2">
        <Qty value={qty} onChange={setQty} />
        <button className="btn-primary btn-sm" onClick={() => submit()}>
          Ajouter · {fcfa(total)}
        </button>
      </div>
    </div>
  );
}

export function Qty({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center rounded-xl border border-line bg-white">
      <button type="button" className="px-3 py-1 font-bold text-violet" onClick={() => onChange(value - 1)} aria-label="Diminuer">
        −
      </button>
      <span className="min-w-6 text-center text-sm font-bold">{value}</span>
      <button type="button" className="px-3 py-1 font-bold text-violet" onClick={() => onChange(value + 1)} aria-label="Augmenter">
        +
      </button>
    </span>
  );
}

/** Contenu du panier (§4.6). */
export function CartView({ deliveryFee }: { deliveryFee: number }) {
  const { cart, ready, subtotal, setQty, clear } = useCart();
  if (!ready) return <p className="text-sm text-muted">Chargement du panier…</p>;
  if (!cart.items.length || !cart.restaurant)
    return (
      <div className="card text-center">
        <p className="mb-4 text-muted">Votre panier est vide.</p>
        <Link href="/restaurants" className="btn-primary">
          Découvrir les restaurants
        </Link>
      </div>
    );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="h2">
            <Link href={`/restaurants/${cart.restaurant.slug}`} className="hover:underline">
              {cart.restaurant.name}
            </Link>
          </h2>
          <button className="btn-ghost btn-sm" onClick={clear}>
            Vider
          </button>
        </div>
        <ul className="divide-y divide-line">
          {cart.items.map((i) => (
            <li key={i.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-bold">{i.name}</p>
                <p className="text-xs text-muted">
                  {fcfa(i.unit_price)} / unité{i.options.length ? " · " + i.options.map((o) => `${o.name} (+${fcfa(o.price)})`).join(", ") : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Qty value={i.quantity} onChange={(n) => setQty(i.key, n)} />
                <span className="price w-28 text-right">{fcfa(lineTotal(i))}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <aside className="card h-fit">
        <h2 className="h3 mb-3">Récapitulatif</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Montant des produits</dt>
            <dd className="font-bold">{fcfa(subtotal)}</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>Frais de livraison (si livraison)</dt>
            <dd>{fcfa(deliveryFee)}</dd>
          </div>
          <p className="text-xs text-muted">Les réductions éventuelles et le total exact sont calculés à l&apos;étape suivante.</p>
        </dl>
        <Link href="/commande" className="btn-primary mt-4 w-full">
          Passer la commande
        </Link>
        <p className="mt-3 text-xs text-muted">Une commande = un restaurant. Un compte vous sera demandé à la validation.</p>
      </aside>
    </div>
  );
}

/** Recommander un repas déjà commandé (§4.9). */
export function ReorderButton({
  restaurant,
  items,
}: {
  restaurant: { id: string; name: string; slug: string };
  items: { product_id: string; name: string; unit_price: number; quantity: number; options: CartOption[] }[];
}) {
  const { replaceWith } = useCart();
  const router = useRouter();
  return (
    <button
      className="btn-outline btn-sm"
      onClick={() => {
        replaceWith(restaurant, items);
        router.push("/panier");
      }}
    >
      Recommander
    </button>
  );
}
