"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Banknote,
  Bike,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Coins,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  Tag,
  Users,
  Utensils,
  Wallet,
} from "lucide-react";

const ICONS = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  menu: Utensils,
  promo: Tag,
  couriers: Bike,
  finance: ChartColumn,
  settlements: Coins,
  calendar: CalendarDays,
  settings: Settings,
  store: Store,
  users: Users,
  cash: Banknote,
  help: LifeBuoy,
  shield: ShieldCheck,
  wallet: Wallet,
  receipt: Receipt,
};
export type NavIcon = keyof typeof ICONS;

/** Coque des espaces professionnels : barre latérale (ordinateur) et onglets défilants (mobile). */
export function SpaceShell({ title, items, children }: { title: string; items: { href: string; label: string; icon: NavIcon }[]; children: ReactNode }) {
  const path = usePathname();
  const isActive = (href: string) => href === path || (href !== items[0].href && path.startsWith(href));
  return (
    <div className="lg:container-dg lg:grid lg:grid-cols-[230px_1fr] lg:gap-6">
      <nav aria-label={title} className="sticky top-16 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur-xl lg:top-24 lg:mt-6 lg:h-fit lg:rounded-3xl lg:border lg:bg-white lg:p-3 lg:shadow-[var(--shadow-soft)]">
        <p className="hidden px-3 pt-1 pb-3 text-[11px] font-bold tracking-[0.18em] text-violet/50 uppercase lg:block">{title}</p>
        <ul className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-2 lg:flex-col lg:p-0">
          {items.map((i) => {
            const Icon = ICONS[i.icon];
            const active = isActive(i.href);
            return (
              <li key={i.href} className="shrink-0">
                <Link
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-all lg:rounded-2xl lg:py-2.5 ${
                    active ? "bg-violet text-white shadow-[var(--shadow-soft)]" : "text-violet/75 hover:bg-lilac hover:text-violet"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-orange" : ""}`} aria-hidden />
                  {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0 lg:[&_.container-dg]:px-0">{children}</div>
    </div>
  );
}
