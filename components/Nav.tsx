"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, LayoutDashboard, ShoppingBag, Tag, User, Utensils } from "lucide-react";
import type { ComponentType } from "react";
import { useCart } from "@/components/cart";

const MAIN = [
  { href: "/restaurants", label: "Restaurants" },
  { href: "/promotions", label: "Promotions" },
  { href: "/aide", label: "Aide" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function MainNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navigation principale" className="hidden items-center gap-1 rounded-full bg-lilac/60 p-1 md:flex">
      {MAIN.map((l) => {
        const active = isActive(path, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${active ? "bg-white text-violet shadow-sm" : "text-violet/75 hover:text-violet"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

type Tab = { href: string; label: string; icon: ComponentType<{ className?: string }>; badge?: number };

/** Barre d'onglets mobile, comme dans une application (§18 : navigation facile sur smartphone). */
export function MobileTabBar({ role, unread }: { role: string | null; unread: number }) {
  const path = usePathname();
  const { count } = useCart();
  const tabs: Tab[] =
    role && role !== "client"
      ? [
          { href: "/", label: "Accueil", icon: House },
          { href: role === "admin" ? "/admin" : role === "livreur" ? "/livreur" : "/restaurant", label: "Mon espace", icon: LayoutDashboard },
          { href: "/notifications", label: "Alertes", icon: Bell, badge: unread },
        ]
      : [
          { href: "/", label: "Accueil", icon: House },
          { href: "/restaurants", label: "Restaurants", icon: Utensils },
          { href: "/promotions", label: "Promos", icon: Tag },
          { href: "/panier", label: "Panier", icon: ShoppingBag, badge: count },
          { href: role ? "/compte" : "/connexion", label: role ? "Compte" : "Connexion", icon: User },
        ];
  return (
    <nav
      aria-label="Navigation mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="flex justify-around px-2">
        {tabs.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(path, href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold">
                <span className={`relative grid h-8 w-12 place-items-center rounded-full transition-colors ${active ? "bg-lilac text-violet" : "text-muted"}`}>
                  <Icon className="size-5" />
                  {!!badge && badge > 0 && (
                    <span className="absolute -top-0.5 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange px-1 text-[9px] font-extrabold text-violet-800">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className={active ? "text-violet" : "text-muted"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
