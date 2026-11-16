"use client";

import { useEffect, useRef, useState } from "react";

/** Onglets des rubriques du menu, collés en haut, qui suivent la lecture (scroll spy). */
export function MenuTabs({ items }: { items: { id: string; name: string; count: number }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace("cat-", ""));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    items.forEach((i) => {
      const el = document.getElementById(`cat-${i.id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [items]);

  useEffect(() => {
    // Défilement horizontal de la barre uniquement (scrollIntoView ferait aussi défiler la page)
    const el = bar.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (el && bar.current) bar.current.scrollTo({ left: el.offsetLeft - bar.current.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  if (!items.length) return null;
  return (
    <div className="sticky top-16 z-20 -mx-4 border-b border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-full sm:border sm:bg-white/85 sm:px-2 sm:py-2 sm:shadow-[var(--shadow-soft)]">
      <div ref={bar} className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {items.map((i) => (
          <a
            key={i.id}
            data-id={i.id}
            href={`#cat-${i.id}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              active === i.id ? "bg-violet text-white shadow-sm" : "text-violet/70 hover:bg-lilac hover:text-violet"
            }`}
          >
            {i.name} <span className={active === i.id ? "text-white/60" : "text-violet/40"}>{i.count}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
