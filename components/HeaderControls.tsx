"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId } from "react";
import { ChevronDown, MapPin, Search } from "lucide-react";

/** Choix de la ville : ouvre la liste des restaurants de cette ville. */
export function CityPicker({ cities, compact = false }: { cities: string[]; compact?: boolean }) {
  const router = useRouter();
  return (
    <label className={`relative flex shrink-0 items-center gap-1.5 rounded-full bg-orange text-violet-800 transition hover:bg-orange-500 ${compact ? "size-11 justify-center" : "h-11 pr-8 pl-3.5"}`}>
      <MapPin className="size-4 shrink-0" aria-hidden />
      <span className={compact ? "sr-only" : "text-sm font-bold"}>Ville</span>
      <select
        aria-label="Choisir une ville"
        defaultValue=""
        onChange={(e) => {
          const c = e.target.value;
          router.push(c ? `/restaurants?city=${encodeURIComponent(c)}` : "/restaurants");
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="" disabled>
          Choisir une ville
        </option>
        <option value="">Toutes les villes</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {!compact && <ChevronDown className="pointer-events-none absolute right-3 size-3.5" aria-hidden />}
    </label>
  );
}

export function HeaderSearch() {
  const id = useId();
  return (
    <form action="/restaurants" role="search" className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white pr-1.5 pl-4 shadow-sm">
      <Search className="size-4 shrink-0 text-violet-300" aria-hidden />
      <label htmlFor={id} className="sr-only">
        Rechercher un restaurant, un plat ou un quartier
      </label>
      <input id={id} name="q" placeholder="Restaurant, plat, quartier…" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
      <button className="hidden h-8 shrink-0 rounded-full bg-violet px-3.5 text-xs font-bold text-white transition hover:bg-violet-600 sm:block">Trouver</button>
    </form>
  );
}

/** Deuxième ligne de l'en-tête sur mobile (masquée dans les espaces professionnels). */
export function MobileSearchRow({ cities }: { cities: string[] }) {
  const path = usePathname();
  if (["/restaurant", "/admin", "/livreur"].some((p) => path === p || path.startsWith(p + "/"))) return null;
  return (
    <div className="mt-2 flex items-center gap-2 md:hidden">
      <CityPicker cities={cities} compact />
      <HeaderSearch />
    </div>
  );
}
