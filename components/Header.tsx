import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { getProfile, homeFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LogoHorizontal } from "@/components/Logo";
import { CartBadge } from "@/components/CartWidgets";
import { MobileTabBar } from "@/components/Nav";
import { CityPicker, HeaderSearch, MobileSearchRow } from "@/components/HeaderControls";
import { signOut } from "@/app/actions/auth";

const SPACE_LABEL: Record<string, string> = {
  client: "Mon compte",
  restaurant: "Espace restaurant",
  livreur: "Espace livreur",
  admin: "Administration",
};

export async function Header() {
  const profile = await getProfile();
  const supabase = await createClient();
  let unread = 0;
  if (profile) {
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
    unread = count ?? 0;
  }
  const { data: zones } = await supabase.from("zones").select("city");
  const cities = [...new Set((zones ?? []).map((z) => z.city as string))].sort((a, b) => a.localeCompare(b, "fr"));
  const initial = (profile?.full_name || profile?.email || "?").trim().charAt(0).toUpperCase();
  const shopper = !profile || profile.role === "client";

  return (
    <>
      {/* Barre du haut flottante aux couleurs de la marque */}
      <header className="sticky top-0 z-40 bg-canvas/85 px-2 pt-2 pb-1 backdrop-blur-xl sm:px-3 sm:pt-3">
        <div className="mx-auto max-w-[1400px] rounded-[24px] bg-violet px-2.5 py-2 text-white shadow-[var(--shadow-lift)] sm:px-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="shrink-0 rounded-full bg-white/10 py-1 pr-3 pl-1">
              <LogoHorizontal onDark size={34} />
            </span>
            <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
              <CityPicker cities={cities} />
              <HeaderSearch />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {shopper && <CartBadge onDark />}
              {profile ? (
                <>
                  <Link href="/notifications" className="btn-icon relative bg-white/10 text-white hover:bg-white/20" aria-label={`Notifications (${unread} non lues)`}>
                    <Bell className="size-5" aria-hidden />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-orange px-1 text-[10px] font-extrabold text-violet-800 ring-2 ring-violet">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </Link>
                  <Link href={homeFor(profile.role)} className="hidden items-center gap-2 rounded-full bg-white py-1 pr-4 pl-1 text-sm font-bold text-violet transition hover:bg-lilac lg:inline-flex">
                    <span className="grid size-8 place-items-center rounded-full bg-orange text-violet-800">{initial}</span>
                    {SPACE_LABEL[profile.role]}
                  </Link>
                  <form action={signOut}>
                    <button className="btn-icon bg-white/10 text-white/80 hover:bg-white/20 hover:text-white" type="submit" aria-label="Déconnexion" title="Déconnexion">
                      <LogOut className="size-5" aria-hidden />
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/connexion" className="hidden h-10 items-center rounded-full border border-white/40 px-4 text-sm font-bold text-white transition hover:bg-white/10 sm:inline-flex">
                    Se connecter
                  </Link>
                  <Link href="/inscription" className="btn-primary btn-sm">
                    Inscription
                  </Link>
                </>
              )}
            </div>
          </div>
          {/* Mobile : ville + recherche sur une deuxième ligne */}
          <MobileSearchRow cities={cities} />
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
