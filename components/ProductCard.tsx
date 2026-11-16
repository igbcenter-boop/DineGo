import Link from "next/link";
import { Tag } from "lucide-react";
import { AddToCart } from "@/components/CartWidgets";
import { fcfa } from "@/lib/format";

/** Pictogramme de secours tant que le restaurant n'a pas ajouté de photo du plat. */
const DISH_EMOJI: [RegExp, string][] = [
  [/pizza|margherita/i, "🍕"],
  [/brochette|kebab/i, "🍢"],
  [/poulet|chicken/i, "🍗"],
  [/poisson|capitaine|tilapia/i, "🐟"],
  [/agneau|mouton|c[ôo]telette|viande|b[œo]euf/i, "🍖"],
  [/burger/i, "🍔"],
  [/riz|atti[ée]k[ée]/i, "🍚"],
  [/\bt[ôo]\b|sauce|soupe|rago[ûu]t/i, "🍲"],
  [/alloco|banane|plantain/i, "🍌"],
  [/frite/i, "🍟"],
  [/croissant|viennoiserie/i, "🥐"],
  [/g[âa]teau|tiramisu|dessert|tarte/i, "🍰"],
  [/beignet|donut/i, "🍩"],
  [/caf[ée]|\bth[ée]\b|cappuccino/i, "☕"],
  [/eau/i, "💧"],
  [/jus|bissap|gingembre|tamarin|baobab|bouye|soda|boisson/i, "🥤"],
  [/salade|l[ée]gume/i, "🥗"],
  [/p[âa]tes|spaghetti/i, "🍝"],
  [/pain|baguette/i, "🥖"],
];
export function dishEmoji(name: string) {
  return DISH_EMOJI.find(([re]) => re.test(name))?.[1] ?? "🍽️";
}

export type ProductCardData = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  photo_url: string | null;
  available: boolean;
  options: { name: string; price: number }[] | null;
  is_combo?: boolean;
};

/**
 * Carte de plat façon vitrine : grande photo, bouton « + » d'ajout rapide,
 * nom, prix et restaurant. L'ajout au panier respecte la règle « un restaurant par commande ».
 */
export function ProductCard({
  p,
  restaurant,
  showRestaurant = false,
  discount,
  disabled = false,
  className = "",
}: {
  p: ProductCardData;
  restaurant: { id: string; name: string; slug: string };
  showRestaurant?: boolean;
  discount?: number;
  disabled?: boolean;
  className?: string;
}) {
  const unavailable = !p.available || disabled;
  return (
    <article id={`p-${p.id}`} className={`group flex scroll-mt-36 flex-col overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-soft)] ring-1 ring-line/80 transition hover:shadow-[var(--shadow-lift)] ${unavailable ? "opacity-60" : ""} ${className}`}>
      <div className="relative">
        <Link href={`/restaurants/${restaurant.slug}#p-${p.id}`} tabIndex={-1} aria-hidden className="block">
          <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-gradient-to-br from-lilac to-peach text-6xl sm:text-7xl">
            {p.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <span className="transition-transform duration-300 group-hover:scale-110">{dishEmoji(p.name)}</span>
            )}
          </div>
        </Link>
        {!!discount && (
          <span className="badge absolute top-3 left-3 bg-orange text-violet-800 shadow-sm">
            <Tag className="size-3" aria-hidden />-{discount}%
          </span>
        )}
        {p.is_combo && <span className="badge absolute top-3 right-3 bg-white/95 text-violet shadow-sm">Menu</span>}
        <div className="absolute right-2.5 -bottom-5">
          <AddToCart restaurant={restaurant} product={{ id: p.id, name: p.name, price: p.price, options: p.options ?? [] }} disabled={unavailable} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3.5 pt-3 pb-3.5 text-center">
        <h3 className="line-clamp-2 pr-6 text-[15px] leading-snug font-bold text-ink sm:pr-0">{p.name}</h3>
        {showRestaurant ? (
          <p className="line-clamp-1 text-xs text-muted">{restaurant.name}</p>
        ) : (
          p.description && <p className="line-clamp-2 text-xs leading-relaxed text-muted">{p.description}</p>
        )}
        {!!p.options?.length && !showRestaurant && <p className="line-clamp-1 text-[11px] text-violet/55">+ options</p>}
        <p className="mt-auto pt-1 text-base font-extrabold text-orange-700">{fcfa(p.price)}</p>
      </div>
    </article>
  );
}
