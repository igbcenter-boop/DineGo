import Link from "next/link";
import type { ReactNode } from "react";
import { LogoHorizontal } from "@/components/Logo";
import { Illustration, type IllustrationName } from "@/components/Illustrations";

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
  const dark = tone === "violet";
  const bg = tone === "violet" ? "bg-violet" : tone === "cream" ? "bg-cream" : "bg-white border-b border-line";
  const panel = dark ? "bg-violet-500" : "bg-violet md:rounded-tl-[140px]";
  return (
    <section className={`${bg} overflow-hidden`}>
      <div className="mx-auto grid max-w-6xl md:min-h-[380px] md:grid-cols-[1.45fr_1fr]">
        <div className="flex flex-col justify-center gap-4 px-4 py-8 sm:px-6 md:py-10">
          <div className="flex items-center justify-between gap-3">
            <LogoHorizontal onDark={dark} size={28} href="/" />
            <nav aria-label="Fil d'Ariane" className={`hidden text-xs sm:block ${dark ? "text-white/80" : "text-violet"}`}>
              <Link href="/" className="hover:underline">
                Accueil
              </Link>
              {crumbs.map((c) => (
                <span key={c.label}>
                  {" › "}
                  {c.href ? (
                    <Link href={c.href} className="hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    c.label
                  )}
                </span>
              ))}
            </nav>
          </div>
          <h1 className={`text-3xl font-extrabold leading-tight sm:text-4xl ${dark ? "text-white" : "text-violet"}`}>
            {title} {highlight && <span className="text-orange">{highlight}</span>}
          </h1>
          {text && <p className={`max-w-xl text-sm ${dark ? "text-white/85" : "text-muted"}`}>{text}</p>}
          {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
        <div className={`hidden items-center justify-center p-8 md:flex ${panel}`}>
          {aside ?? (illustration ? <Illustration name={illustration} count={count} /> : null)}
        </div>
      </div>
    </section>
  );
}

/** Raccourcis de rubriques affichés sous le titre d'une bannière. */
export function BannerChips({ items, dark }: { items: { label: string; href: string }[]; dark?: boolean }) {
  return (
    <>
      {items.map((i) => (
        <Link key={i.href + i.label} href={i.href} className={dark ? "chip-on-dark" : "chip hover:bg-lilac-200"}>
          {i.label}
        </Link>
      ))}
    </>
  );
}
