"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SpaceNav({ items, title }: { items: { href: string; label: string }[]; title: string }) {
  const path = usePathname();
  return (
    <nav aria-label={title} className="border-b border-line bg-lilac/40">
      <div className="container-dg flex items-center gap-1 overflow-x-auto py-2">
        <span className="mr-2 hidden whitespace-nowrap text-xs font-bold uppercase tracking-wide text-violet/70 lg:inline">{title}</span>
        {items.map((i) => {
          const active = i.href === path || (i.href !== items[0].href && path.startsWith(i.href));
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-violet text-white" : "text-violet hover:bg-lilac-200"}`}
            >
              {i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
