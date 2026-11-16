"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Bike, CalendarDays, Clock, House, LifeBuoy, Sparkles, Tag, Utensils } from "lucide-react";

type Category = { name: string; slug: string; icon: string };

/** Les espaces professionnels ont leur propre navigation : pas de menu public. */
export function isProSpace(path: string) {
  return ["/restaurant", "/admin", "/livreur"].some((p) => path === p || path.startsWith(p + "/"));
}

const MAIN = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/restaurants", label: "Restaurants", icon: Utensils },
  { href: "/promotions", label: "Promotions", icon: Tag },
  { href: "/restaurants?open=1", label: "Ouvert maintenant", icon: Clock },
];
const MORE = [
  { href: "/reservation", label: "Réserver une table", icon: CalendarDays },
  { href: "/devenir-livreur", label: "Devenir livreur", icon: Bike },
  { href: "/aide", label: "Aide", icon: LifeBuoy },
];

/** Mise en page publique : menu latéral (tablette et ordinateur) + contenu. */
export function AppShell({ categories, children }: { categories: Category[]; children: ReactNode }) {
  const path = usePathname();
  if (isProSpace(path)) return <>{children}</>;
  const active = (href: string) => (href === "/" ? path === "/" : !href.includes("?") && (path === href || path.startsWith(href + "/")));

  const item = (href: string, label: string, Icon: typeof House) => {
    const on = active(href);
    return (
      <li key={href}>
        <Link
          href={href}
          aria-current={on ? "page" : undefined}
          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${on ? "bg-lilac text-violet" : "text-ink/75 hover:bg-lilac/60 hover:text-violet"}`}
        >
          <Icon className={`size-[18px] shrink-0 ${on ? "text-orange-600" : "text-violet/70"}`} aria-hidden />
          <span className="truncate">{label}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] md:grid md:grid-cols-[212px_minmax(0,1fr)] md:gap-5 md:px-3 lg:px-4">
      <aside className="hidden md:block">
        <nav aria-label="Menu" className="no-scrollbar sticky top-[92px] mt-4 max-h-[calc(100dvh-110px)] overflow-y-auto rounded-3xl bg-white p-2.5 shadow-[var(--shadow-soft)] ring-1 ring-line/70 sm:mt-6">
          <Link href="/devenir-partenaire" className="mb-2 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-peach to-cream px-3 py-2.5 text-sm font-bold text-violet ring-1 ring-peach transition hover:brightness-[1.03]">
            <Sparkles className="size-[18px] text-orange-600" aria-hidden />
            Devenir partenaire
          </Link>
          <ul className="space-y-0.5">{MAIN.map((m) => item(m.href, m.label, m.icon))}</ul>
          <p className="mt-4 mb-1 px-3 text-[11px] font-bold tracking-[0.16em] text-violet/45 uppercase">Catégories</p>
          <ul className="space-y-0.5">
            {categories.slice(0, 9).map((c) => (
              <li key={c.slug}>
                <Link href={`/restaurants?category=${c.slug}`} className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-ink/75 transition-colors hover:bg-lilac/60 hover:text-violet">
                  <span className="grid size-[18px] place-items-center text-base leading-none" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="truncate">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="my-2 border-t border-line" />
          <ul className="space-y-0.5">{MORE.map((m) => item(m.href, m.label, m.icon))}</ul>
        </nav>
      </aside>
      <div className="min-w-0 md:[&_.container-dg]:max-w-none md:[&_.container-dg]:px-0">{children}</div>
    </div>
  );
}
