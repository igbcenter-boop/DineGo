import Link from "next/link";
import { getProfile, homeFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LogoHorizontal } from "@/components/Logo";
import { CartBadge } from "@/components/CartWidgets";
import { signOut } from "@/app/actions/auth";

export async function Header() {
  const profile = await getProfile();
  let unread = 0;
  if (profile) {
    const supabase = await createClient();
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
    unread = count ?? 0;
  }
  const spaceLabel: Record<string, string> = {
    client: "Mon compte",
    restaurant: "Espace restaurant",
    livreur: "Espace livreur",
    admin: "Administration",
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-dg flex h-16 items-center justify-between gap-3">
        <LogoHorizontal size={34} compact />
        <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
          <Link href="/restaurants" className="btn-ghost">
            Restaurants
          </Link>
          <Link href="/promotions" className="btn-ghost">
            Promotions
          </Link>
          <Link href="/aide" className="btn-ghost">
            Aide
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          {(!profile || profile.role === "client") && <CartBadge />}
          {profile ? (
            <>
              <Link href="/notifications" className="relative rounded-xl px-2 py-2 text-violet hover:bg-lilac" aria-label={`Notifications (${unread} non lues)`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
                  <path d="M10 20a2 2 0 0 0 4 0" />
                </svg>
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-orange px-1 text-[11px] font-extrabold text-violet-700">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href={homeFor(profile.role)} className="btn-violet btn-sm">
                <span className="sm:hidden">Mon espace</span>
                <span className="hidden sm:inline">{spaceLabel[profile.role]}</span>
              </Link>
              <form action={signOut}>
                <button className="btn-ghost btn-sm" type="submit" aria-label="Déconnexion">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="sm:hidden">
                    <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
                  </svg>
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/connexion" className="btn-ghost btn-sm">
                Connexion
              </Link>
              <Link href="/inscription" className="btn-primary btn-sm">
                Inscription
              </Link>
            </>
          )}
        </div>
      </div>
      <nav aria-label="Navigation mobile" className="flex gap-1 overflow-x-auto border-t border-line px-4 py-1 md:hidden">
        <Link href="/restaurants" className="btn-ghost btn-sm">
          Restaurants
        </Link>
        <Link href="/promotions" className="btn-ghost btn-sm">
          Promotions
        </Link>
        <Link href="/aide" className="btn-ghost btn-sm">
          Aide
        </Link>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 bg-violet text-white">
      <div className="container-dg grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <LogoHorizontal onDark slogan size={40} />
          <p className="text-sm text-white/80">La marketplace nationale de restauration et de livraison du Burkina Faso.</p>
        </div>
        <div>
          <p className="mb-2 font-bold">Commander</p>
          <ul className="space-y-1 text-sm text-white/85">
            <li><Link href="/restaurants" className="hover:underline">Tous les restaurants</Link></li>
            <li><Link href="/promotions" className="hover:underline">Promotions</Link></li>
            <li><Link href="/reservation" className="hover:underline">Réserver une table</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-bold">Partenaires</p>
          <ul className="space-y-1 text-sm text-white/85">
            <li><Link href="/devenir-partenaire" className="hover:underline">Devenir restaurant partenaire</Link></li>
            <li><Link href="/devenir-livreur" className="hover:underline">Devenir livreur</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-bold">Assistance</p>
          <ul className="space-y-1 text-sm text-white/85">
            <li><Link href="/aide" className="hover:underline">Aide et réclamations</Link></li>
            <li><Link href="/connexion" className="hover:underline">Connexion</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-white/15 py-4 text-center text-xs font-semibold tracking-[0.2em] text-white/70">
        DINEGO — CHOISISSEZ. COMMANDEZ. SAVOUREZ.
      </p>
    </footer>
  );
}
