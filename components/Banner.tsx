import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { LogoHorizontal } from "@/components/Logo";
import { Illustration, type IllustrationName } from "@/components/Illustrations";

const TONE = {
  violet: {
    box: "bg-violet text-white",
    deco: "pattern-dots",
    blob: "bg-violet-500",
    glow: "bg-orange/25",
    text: "text-white/80",
    crumbs: "text-white/70 hover:text-white",
  },
  white: {
    box: "bg-white text-violet ring-1 ring-line",
    deco: "pattern-dots-violet",
    blob: "bg-violet",
    glow: "bg-orange/15",
    text: "text-muted",
    crumbs: "text-violet/60 hover:text-violet",
  },
  cream: {
    box: "bg-cream text-violet ring-1 ring-peach",
    deco: "pattern-dots-violet",
    blob: "bg-violet",
    glow: "bg-orange/25",
    text: "text-violet/70",
    crumbs: "text-violet/60 hover:text-violet",
  },
} as const;

/**
 * Bannière d'en-tête de page (§27).
 * tone : violet (pages d'action / espaces connectés), white (consultation, gestion),
 * cream (pages gourmandes et commerciales).
 */
export function Banner({
  tone,
  crumbs,
  title,
  highlight,
  text,
  children,
  illustration,
  count,
  aside,
}: {
  tone: "violet" | "white" | "cream";
  crumbs: { label: string; href?: string }[];
  title: string;
  highlight?: string;
  text?: ReactNode;
  children?: ReactNode;
  illustration?: IllustrationName;
  count?: number;
  aside?: ReactNode;
}) {
  const t = TONE[tone];
  const dark = tone === "violet";
  return (
    <section className="container-dg pt-4 sm:pt-6">
      <div className={`relative isolate overflow-hidden rounded-[28px] sm:rounded-[36px] ${t.box}`}>
        <div className={`absolute inset-0 -z-10 ${t.deco}`} aria-hidden />
        <div className={`absolute -top-24 -left-16 -z-10 size-72 rounded-full blur-3xl ${t.glow}`} aria-hidden />
        <div className="grid md:min-h-[380px] md:grid-cols-[1.35fr_1fr]">
          <div className="flex flex-col justify-center gap-5 px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex items-center justify-between gap-3">
              <LogoHorizontal onDark={dark} size={30} href="/" />
              <nav aria-label="Fil d'Ariane" className="hidden items-center gap-1 text-xs font-medium sm:flex">
                <Link href="/" className={`transition ${t.crumbs}`}>
                  Accueil
                </Link>
                {crumbs.map((c) => (
                  <span key={c.label} className="flex items-center gap-1">
                    <ChevronRight className={`size-3 ${dark ? "text-white/40" : "text-violet/30"}`} aria-hidden />
                    {c.href ? (
                      <Link href={c.href} className={`transition ${t.crumbs}`}>
                        {c.label}
                      </Link>
                    ) : (
                      <span className={dark ? "text-white" : "text-violet"}>{c.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            </div>
            <h1 className="animate-fade-up text-[30px] leading-[1.08] font-extrabold tracking-tight text-balance sm:text-[44px]">
              {title} {highlight && <span className="text-orange">{highlight}</span>}
            </h1>
            {text && <p className={`max-w-xl text-[15px] leading-relaxed ${t.text}`}>{text}</p>}
            {children && <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>}
          </div>
          <div className="relative hidden items-center justify-center p-8 md:flex">
            <div className={`absolute inset-y-6 right-6 left-0 rounded-[32px] ${dark ? "bg-violet-500/60" : t.blob} rounded-tl-[120px]`} aria-hidden />
            <div className="absolute right-10 bottom-10 size-24 rounded-full bg-orange/30 blur-2xl" aria-hidden />
            <div className="relative w-full max-w-xs drop-shadow-[0_18px_30px_rgba(34,8,47,0.35)]">
              {aside ?? (illustration ? <Illustration name={illustration} count={count} /> : null)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Raccourcis de rubriques affichés sous le titre d'une bannière. */
export function BannerChips({ items, dark }: { items: { label: string; href: string }[]; dark?: boolean }) {
  return (
    <div className="no-scrollbar -mx-1 flex max-w-full gap-2 overflow-x-auto px-1 py-0.5">
      {items.map((i) => (
        <Link key={i.href + i.label} href={i.href} className={dark ? "chip-on-dark" : "chip bg-white ring-1 ring-line hover:bg-lilac"}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}
