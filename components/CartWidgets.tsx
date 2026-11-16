"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { lineTotal, useCart, type CartOption } from "@/components/cart";
import { fcfa } from "@/lib/format";

/** Petit rebond du compteur quand le panier change. */
function usePop(value: number) {
  const [pop, setPop] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 400);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return pop;
}

export function CartBadge({ onDark = false }: { onDark?: boolean }) {
  const { count } = useCart();
  const pop = usePop(count);
  return (
    <Link
      href="/panier"
      className={`btn-icon relative hidden md:inline-grid ${onDark ? "bg-white/10 text-white hover:bg-white/20" : "text-violet hover:bg-lilac"}`}
      aria-label={`Panier (${count} article${count > 1 ? "s" : ""})`}
    >
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 && (
        <span className={`absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-orange px-1 text-[10px] font-extrabold text-violet-800 ring-2 ${onDark ? "ring-violet" : "ring-white"} ${pop ? "animate-pop" : ""}`}>
          {count}
        </span>
      )}
    </Link>
  );
}

const HIDE_BAR = ["/panier", "/commande", "/compte/commandes", "/restaurant", "/admin", "/livreur", "/connexion", "/inscription"];

/** Barre de panier flottante : le client voit en permanence où il en est. */
export function CartBar() {
  const { cart, count, subtotal, ready } = useCart();
  const path = usePathname();
  const pop = usePop(count);
  if (!ready || !count || !cart.restaurant) return null;
  if (HIDE_BAR.some((p) => path === p || path.startsWith(p + "/"))) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-3 md:right-24 md:bottom-6 md:left-auto md:justify-end">
      <Link
        href="/panier"
        className={`animate-slide-up pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-full bg-violet-800 py-2 pr-2 pl-2 text-white shadow-[var(--shadow-lift)] ring-1 ring-white/10 transition hover:bg-violet-700 md:w-auto ${pop ? "[&>span:first-child]:animate-pop" : ""}`}
      >
        <span className="grid size-10 place-items-center rounded-full bg-orange font-extrabold text-violet-800">{count}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-bold">Voir le panier</span>
          <span className="block truncate text-xs text-white/70">{cart.restaurant.name}</span>
        </span>
        <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-2 text-sm font-extrabold">
          {fcfa(subtotal)} <ArrowRight className="size-4" aria-hidden />
        </span>
      </Link>
    </div>
  );
}

type ProductLite = { id: string; name: string; price: number; options: CartOption[] };

/** Panneau du bas (mobile) / fenêtre centrée (ordinateur). */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-violet-900/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Fermer" tabIndex={-1} />
      <div className="animate-slide-up relative w-full max-w-md rounded-t-[28px] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)] sm:rounded-[28px]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-lilac-300 sm:hidden" aria-hidden />
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-lg font-extrabold tracking-tight text-violet">{title}</p>
          <button onClick={onClose} className="btn-icon size-9 bg-lilac text-violet" aria-label="Fermer">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

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
  const [added, setAdded] = useState(false);
  const [conflict, setConflict] = useState(false);

  const options = product.options.filter((o) => chosen.includes(o.name));
  const total = lineTotal({ unit_price: product.price, quantity: qty, options });

  function submit(replace = false) {
    const res = add(restaurant, { product_id: product.id, name: product.name, unit_price: product.price, quantity: qty, options }, replace);
    if (res === "conflict") {
      setOpen(false);
      setConflict(true);
      return;
    }
    setOpen(false);
    setConflict(false);
    setQty(1);
    setChosen([]);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  if (disabled) return <span className="chip bg-zinc-100 text-zinc-500">Indisponible</span>;

  return (
    <>
      <div className="flex items-center gap-2">
        {added && (
          <span className="animate-fade-up rounded-full bg-white px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-emerald-700 shadow-[var(--shadow-soft)] ring-1 ring-emerald-100" role="status">
            Ajouté au panier ✓
          </span>
        )}
        <button
          className="btn-icon size-10 bg-orange text-violet-800 shadow-[var(--shadow-glow)] hover:bg-orange-500"
          onClick={() => (product.options.length ? setOpen(true) : submit())}
          aria-label={`Ajouter ${product.name}`}
        >
          <Plus className="size-5" strokeWidth={2.75} aria-hidden />
        </button>
      </div>

      {open && (
        <Sheet title={product.name} onClose={() => setOpen(false)}>
          <p className="eyebrow mb-2">Options et suppléments</p>
          <div className="mb-4 divide-y divide-line rounded-2xl border border-line">
            {product.options.map((o) => (
              <label key={o.name} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={chosen.includes(o.name)}
                    onChange={(e) => setChosen((c) => (e.target.checked ? [...c, o.name] : c.filter((x) => x !== o.name)))}
                  />
                  {o.name}
                </span>
                <span className="text-xs font-semibold text-muted">{o.price ? `+${fcfa(o.price)}` : "offert"}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Qty value={qty} onChange={(n) => setQty(Math.max(1, n))} />
            <button className="btn-primary min-w-0 flex-1 px-4 leading-tight whitespace-normal" onClick={() => submit()}>
              Ajouter au panier · {fcfa(total)}
            </button>
          </div>
        </Sheet>
      )}

      {conflict && (
        <Sheet title="Un seul restaurant par commande" onClose={() => setConflict(false)}>
          <p className="mb-5 text-sm text-muted" role="alert">
            Une commande ne peut concerner qu&apos;un seul restaurant. Votre panier contient déjà des plats de « {cart.restaurant?.name} ».
          </p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button className="btn-primary flex-1" onClick={() => submit(true)}>
              Vider et ajouter
            </button>
            <button className="btn-outline flex-1" onClick={() => setConflict(false)}>
              Garder mon panier
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

export function Qty({ value, onChange, small }: { value: number; onChange: (n: number) => void; small?: boolean }) {
  const s = small ? "size-8" : "size-10";
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-lilac p-1">
      <button type="button" className={`btn-icon ${s} bg-white text-violet shadow-sm`} onClick={() => onChange(value - 1)} aria-label="Diminuer">
        {value <= 1 && small ? <Trash2 className="size-3.5" aria-hidden /> : <Minus className="size-4" aria-hidden />}
      </button>
      <span className="min-w-7 text-center text-sm font-extrabold text-violet" aria-live="polite">
        {value}
      </span>
      <button type="button" className={`btn-icon ${s} bg-white text-violet shadow-sm`} onClick={() => onChange(value + 1)} aria-label="Augmenter">
        <Plus className="size-4" aria-hidden />
      </button>
    </span>
  );
}

/** Contenu du panier (§4.6). */
export function CartView({ deliveryFee }: { deliveryFee: number }) {
  const { cart, ready, subtotal, setQty, clear } = useCart();
  if (!ready)
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="skeleton h-72" />
        <div className="skeleton h-56" />
      </div>
    );
  if (!cart.items.length || !cart.restaurant)
    return (
      <div className="card mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
        <span className="grid size-16 place-items-center rounded-3xl bg-lilac text-violet">
          <ShoppingBag className="size-8" aria-hidden />
        </span>
        <div>
          <p className="h3 text-lg">Votre panier est vide</p>
          <p className="text-sm text-muted">Parcourez les restaurants et ajoutez vos plats préférés.</p>
        </div>
        <Link href="/restaurants" className="btn-primary">
          Découvrir les restaurants
        </Link>
      </div>
    );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="card">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Votre commande chez</p>
            <h2 className="h2">
              <Link href={`/restaurants/${cart.restaurant.slug}`} className="hover:underline">
                {cart.restaurant.name}
              </Link>
            </h2>
          </div>
          <button className="btn-ghost btn-sm text-muted" onClick={clear}>
            <Trash2 className="size-4" aria-hidden /> Vider
          </button>
        </div>
        <ul className="divide-y divide-line">
          {cart.items.map((i) => (
            <li key={i.key} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{i.name}</p>
                <p className="text-xs text-muted">
                  {fcfa(i.unit_price)}
                  {i.options.length ? " · " + i.options.map((o) => o.name).join(", ") : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Qty small value={i.quantity} onChange={(n) => setQty(i.key, n)} />
                <span className="price w-24 text-right">{fcfa(lineTotal(i))}</span>
              </div>
            </li>
          ))}
        </ul>
        <Link href={`/restaurants/${cart.restaurant.slug}`} className="btn-ghost btn-sm mt-2">
          <Plus className="size-4" aria-hidden /> Ajouter d&apos;autres plats
        </Link>
      </div>
      <aside className="card h-fit space-y-4 lg:sticky lg:top-24">
        <h2 className="h3 text-lg">Récapitulatif</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Montant des produits</dt>
            <dd className="font-bold">{fcfa(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Livraison (si livraison)</dt>
            <dd>{fcfa(deliveryFee)}</dd>
          </div>
        </dl>
        <p className="rounded-2xl bg-cream px-3 py-2 text-xs text-orange-700">Réductions et total exact calculés à l&apos;étape suivante.</p>
        <Link href="/commande" className="btn-primary w-full">
          Passer la commande <ArrowRight className="size-4" aria-hidden />
        </Link>
        <p className="text-center text-xs text-muted">Une commande = un restaurant · Compte demandé à la validation</p>
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
