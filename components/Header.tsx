import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { getProfile, homeFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LogoHorizontal } from "@/components/Logo";
import { CartBadge } from "@/components/CartWidgets";
import { MainNav, MobileTabBar } from "@/components/Nav";
import { signOut } from "@/app/actions/auth";

const SPACE_LABEL: Record<string, string> = {
  client: "Mon compte",
  restaurant: "Espace restaurant",
  livreur: "Espace livreur",
  admin: "Administration",
};

export async function Header() {
  const profile = await getProfile();
  let unread = 0;
  if (profile) {
    const supabase = await createClient();
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
    unread = count ?? 0;
  }
  const initial = (profile?.full_name || profile?.email || "?").trim().charAt(0).toUpperCase();
  const shopper = !profile || profile.role === "client";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
        <div className="container-dg flex h-16 items-center justify-between gap-3">
          <LogoHorizontal size={36} compact />
          <MainNav />
          <div className="flex items-center gap-1.5">
            {shopper && <CartBadge />}
            {profile ? (
              <>
                <Link href="/notifications" className="btn-icon relative text-violet hover:bg-lilac" aria-label={`Notifications (${unread} non lues)`}>
                  <Bell className="size-5" aria-hidden />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-orange px-1 text-[10px] font-extrabold text-violet-800 ring-2 ring-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
                <Link href={homeFor(profile.role)} className="hidden items-center gap-2 rounded-full bg-violet py-1 pr-4 pl-1 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition hover:bg-violet-600 sm:inline-flex">
                  <span className="grid size-8 place-items-center rounded-full bg-orange text-violet-800">{initial}</span>
                  {SPACE_LABEL[profile.role]}
                </Link>
                <form action={signOut}>
                  <button className="btn-icon text-muted hover:bg-lilac hover:text-violet" type="submit" aria-label="Déconnexion" title="Déconnexion">
                    <LogOut className="size-5" aria-hidden />
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/connexion" className="btn-ghost btn-sm hidden sm:inline-flex">
                  Connexion
                </Link>
                <Link href="/inscription" className="btn-primary btn-sm">
                  Inscription
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <MobileTabBar role={profile?.role ?? null} unread={unread} />
    </>
  );
}

export function Footer() {
  return (
    <footer className="relative mt-20 overflow-hidden bg-violet-800 pb-24 text-white md:pb-0">
      <div className="pattern-dots absolute inset-0 opacity-60" aria-hidden />
      <div className="absolute -top-24 -right-24 size-72 rounded-full bg-orange/20 blur-3xl" aria-hidden />
      <div className="container-dg relative grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <LogoHorizontal onDark slogan size={44} />
          <p className="max-w-xs text-sm text-white/75">La marketplace nationale de restauration et de livraison du Burkina Faso.</p>
          <p className="text-xs text-white/50">Orange Money · Moov Money · Espèces</p>
        </div>
        {[
          ["Commander", [["/restaurants", "Tous les restaurants"], ["/promotions", "Promotions"], ["/reservation", "Réserver une table"]]],
          ["Partenaires", [["/devenir-partenaire", "Devenir restaurant partenaire"], ["/devenir-livreur", "Devenir livreur"]]],
          ["Assistance", [["/aide", "Aide et réclamations"], ["/connexion", "Connexion"], ["/inscription", "Créer un compte"]]],
        ].map(([title, links]) => (
          <div key={title as string}>
            <p className="mb-3 text-sm font-bold">{title as string}</p>
            <ul className="space-y-2 text-sm text-white/75">
              {(links as string[][]).map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-orange">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="relative border-t border-white/10 py-5 text-center text-[11px] font-semibold tracking-[0.25em] text-white/60">
        DINEGO — CHOISISSEZ. COMMANDEZ. SAVOUREZ.
      </p>
    </footer>
  );
}
