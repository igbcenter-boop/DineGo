"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Rangée défilante horizontale avec titre, lien « Tout afficher » et flèches.
 * Les enfants doivent être des éléments à largeur fixe (shrink-0).
 */
export function Rail({
  title,
  subtitle,
  href,
  hrefLabel = "Tout afficher",
  children,
  id,
  arrowsOnly = false,
}: {
  title?: ReactNode;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
  id?: string;
  /** Pas de titre : flèches superposées sur les côtés (ruban de catégories). */
  arrowsOnly?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const arrow = (dir: 1 | -1, extra = "") => {
    const disabled = dir === -1 ? edges.start : edges.end;
    const Icon = dir === -1 ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        onClick={() => scroll(dir)}
        disabled={disabled}
        aria-label={dir === -1 ? "Précédent" : "Suivant"}
        className={`btn-icon size-9 bg-white text-violet shadow-[var(--shadow-soft)] ring-1 ring-line hover:bg-lilac disabled:opacity-35 ${extra}`}
      >
        <Icon className="size-4" aria-hidden />
      </button>
    );
  };

  return (
    <section id={id} className="scroll-mt-28 space-y-3">
      {!arrowsOnly && (title || href) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-lg leading-snug font-extrabold tracking-tight text-violet sm:text-xl">{title}</h2>}
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {href && (
              <Link href={href} className="btn-outline btn-sm bg-white">
                {hrefLabel}
              </Link>
            )}
            <span className="hidden gap-1.5 sm:flex">
              {arrow(-1)}
              {arrow(1)}
            </span>
          </div>
        </div>
      )}
      <div className="relative">
        {arrowsOnly && !edges.start && arrow(-1, "absolute top-1/2 left-1 z-10 hidden -translate-y-1/2 sm:inline-grid")}
        <div ref={track} className="no-scrollbar relative -mx-4 flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0">
          {children}
        </div>
        {arrowsOnly && !edges.end && arrow(1, "absolute top-1/2 right-1 z-10 hidden -translate-y-1/2 sm:inline-grid")}
      </div>
    </section>
  );
}
