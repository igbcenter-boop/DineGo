import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Bike, Clock, MapPin, Search, Sparkles, Star, Store, Tag, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoSymbol } from "@/components/Logo";
import { Rail } from "@/components/Rail";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Empty, RestaurantCard, type RestaurantCardData } from "@/components/ui";
import { fcfa } from "@/lib/format";

const RESTO_FIELDS =
  "id, slug, name, city, cover_url, logo_url, rating_avg, rating_count, price_level, offers_delivery, offers_pickup, is_open, opens_at, closes_at, featured, cuisine_type, categories(name, icon, slug), zones(name)";

type Resto = RestaurantCardData & { cuisine_type: string | null; featured: boolean; categories: { name: string; icon: string; slug: string } | null };
type Dish = ProductCardData & {
  views: number;
  restaurants: { id: string; name: string; slug: string; categories: { slug: string } | null };
  menu_categories: { name: string } | null;
};

/** Carte promotionnelle pastel (bannières de l'accueil, offres, appels partenaires). */
function PromoCard({
  tone,
  badge,
  title,
  sub,
  cta,
  href,
  visual,
}: {
  tone: "violet" | "lilac" | "cream" | "peach" | "orange";
  badge: ReactNode;
  title: ReactNode;
  sub?: string;
  cta: string;
  href: string;
  visual: ReactNode;
}) {
  const t = {
    violet: "bg-violet text-white",
    lilac: "bg-lilac text-violet",
    cream: "bg-cream text-violet",
    peach: "bg-peach text-violet",
    orange: "bg-gradient-to-br from-orange-500 to-orange text-violet-800",
  }[tone];
  const dark = tone === "violet";
  return (
    <Link
      href={href}
      className={`group relative grid min-h-[212px] w-[86%] shrink-0 snap-start grid-cols-[1.25fr_1fr] overflow-hidden rounded-[26px] sm:w-[calc(50%-6px)] xl:w-[calc(33.333%-8px)] ${t}`}
    >
      <div className="relative z-10 flex flex-col justify-between gap-2 p-5">
        <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${dark ? "bg-white/15 text-white" : "bg-white text-violet shadow-sm"}`}>{badge}</span>
        <div>
          <p className="text-[18px] leading-[1.15] font-extrabold tracking-tight text-balance">{title}</p>
          {sub && <p className={`mt-1 line-clamp-1 text-xs ${dark ? "text-white/70" : "opacity-70"}`}>{sub}</p>}
        </div>
        <span className={`w-fit rounded-full px-4 py-2 text-xs font-bold shadow-sm transition group-hover:-translate-y-px ${dark ? "bg-orange text-violet-800" : "bg-white text-violet"}`}>{cta}</span>
      </div>
      <div className="relative overflow-hidden">{visual}</div>
    </Link>
  );
}

function Visual({ photo, emoji }: { photo?: string | null; emoji: string }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
  ) : (
    <span className="absolute -right-3 -bottom-4 text-[7.5rem] leading-none drop-shadow-xl transition-transform duration-500 select-none group-hover:scale-110 group-hover:-rotate-6" aria-hidden>
      {emoji}
    </span>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: categories }, { data: restosRaw }, { data: promos }, { data: dishesRaw }, { data: zones }, { data: fee }] = await Promise.all([
    supabase.from("categories").select("name, slug, icon").order("sort"),
    supabase.from("restaurants").select(RESTO_FIELDS).eq("status", "active").order("featured", { ascending: false }).order("rating_avg", { ascending: false }).limit(30),
    supabase
      .from("promotions")
      .select("id, title, conditions, discount_percent, product_id, products(photo_url), restaurants!inner(name, slug, status, cover_url, categories(icon))")
      .eq("active", true)
      .eq("restaurants.status", "active")
      .lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .limit(6),
    supabase
      .from("products")
      .select("id, name, description, price, photo_url, available, options, is_combo, views, restaurants!inner(id, name, slug, status, categories(slug)), menu_categories(name)")
      .eq("available", true)
      .eq("restaurants.status", "active")
      .order("views", { ascending: false })
      .limit(80),
    supabase.from("zones").select("id, city, name").order("city").order("name"),
    supabase.from("public_fees").select("delivery_fee").maybeSingle(),
  ]);

  const cats = categories ?? [];
  const restos = (restosRaw ?? []) as unknown as Resto[];
  const dishes = (dishesRaw ?? []) as unknown as Dish[];
  const discountOf = new Map((promos ?? []).filter((p) => p.product_id).map((p) => [p.product_id as string, p.discount_percent as number]));
  const topRated = [...restos].filter((r) => r.rating_count > 0).sort((a, b) => Number(b.rating_avg) - Number(a.rating_avg));
  const byTheme = (test: (d: Dish) => boolean) => dishes.filter(test).slice(0, 12);
  const drinks = byTheme((d) => /boisson|jus|caf/i.test(d.menu_categories?.name ?? ""));
  const sweets = byTheme((d) => ["patisseries", "boulangeries"].includes(d.restaurants.categories?.slug ?? "") || /dessert|p[âa]tisserie/i.test(d.menu_categories?.name ?? ""));
  const grills = byTheme((d) => ["grillades", "maquis"].includes(d.restaurants.categories?.slug ?? "") && !/boisson/i.test(d.menu_categories?.name ?? ""));
  const cities = [...new Set((zones ?? []).map((z) => z.city as string))];
  const restoOf = (d: Dish) => ({ id: d.restaurants.id, name: d.restaurants.name, slug: d.restaurants.slug });
  const dishRail = (list: Dish[]) =>
    list.map((d) => (
      <div key={d.id} className="w-[46%] shrink-0 snap-start sm:w-56">
        <ProductCard p={d} restaurant={restoOf(d)} showRestaurant discount={discountOf.get(d.id)} className="h-full" />
      </div>
    ));

  const QUICK = [
    { href: "/promotions", label: "Bons plans", icon: Tag, cls: "bg-cream text-orange-700 ring-peach" },
    { href: "/restaurants?open=1", label: "Ouvert maintenant", icon: Clock, cls: "bg-emerald-50 text-emerald-800 ring-emerald-100" },
    { href: "#mieux-notes", label: "Meilleures adresses", icon: Star, cls: "bg-lilac text-violet ring-lilac-200" },
    { href: "/restaurants?mode=delivery", label: "Livraison", icon: Bike, cls: "bg-white text-violet ring-line" },
    { href: "/restaurants?mode=pickup", label: "Retrait sur place", icon: Store, cls: "bg-white text-violet ring-line" },
  ];

  return (
    <div className="container-dg space-y-10 pt-4 sm:pt-6">
      {/* Ruban des catégories */}
      <Rail arrowsOnly>
        {cats.map((c, i) => (
          <Link key={c.slug} href={`/restaurants?category=${c.slug}`} className="group flex w-[84px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center transition hover:bg-white">
            <span
              className={`grid size-14 place-items-center rounded-2xl text-[28px] shadow-sm ring-1 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 ${
                ["bg-peach ring-peach", "bg-lilac ring-lilac-200", "bg-white ring-line", "bg-cream ring-peach"][i % 4]
              }`}
              aria-hidden
            >
              {c.icon}
            </span>
            <span className="line-clamp-2 text-[11px] leading-tight font-semibold text-ink/80">{c.name}</span>
          </Link>
        ))}
      </Rail>

      {/* Raccourcis */}
      <div className="no-scrollbar -mx-4 -mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {QUICK.map(({ href, label, icon: Icon, cls }) => (
          <Link key={label} href={href} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-sm ring-1 transition hover:-translate-y-px ${cls}`}>
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </div>

      {/* Bannières de l'accueil (§27.3.1 – 27.3.2), offres du moment et appel partenaires */}
      <Rail arrowsOnly>
        <PromoCard
          tone="violet"
          badge="DineGo · Burkina Faso"
          title={
            <>
              Toute la restauration du Burkina, <span className="text-orange">sur une seule plateforme.</span>
            </>
          }
          sub="Menus, prix, livraison ou retrait"
          cta="Découvrir"
          href="/restaurants"
          visual={
            <span className="absolute inset-0 grid place-items-center">
              <span className="drop-shadow-[0_20px_30px_rgba(0,0,0,0.35)] transition-transform duration-500 group-hover:scale-105">
                <LogoSymbol size={118} variant="white" />
              </span>
            </span>
          }
        />
        <PromoCard
          tone="lilac"
          badge="🛵 Livraison ou retrait"
          title={
            <>
              Livré chez vous ou prêt au comptoir. <span className="text-orange-700">À vous de choisir.</span>
            </>
          }
          sub="Mobile Money ou espèces"
          cta="Voir les restaurants"
          href="/restaurants"
          visual={<Visual emoji="🛵" />}
        />
        {(promos ?? []).map((p, i) => {
          const r = p.restaurants as unknown as { name: string; slug: string; cover_url: string | null; categories: { icon: string } | null };
          const photo = (p.products as unknown as { photo_url: string | null } | null)?.photo_url ?? r.cover_url;
          return (
            <PromoCard
              key={p.id}
              tone={i % 2 ? "peach" : "cream"}
              badge={`🏷️ Bon plan · -${p.discount_percent}%`}
              title={p.title}
              sub={`Chez ${r.name}`}
              cta="J'en profite !"
              href={`/restaurants/${r.slug}`}
              visual={<Visual photo={photo} emoji={r.categories?.icon ?? "🍽️"} />}
            />
          );
        })}
        <PromoCard
          tone="orange"
          badge="Espace partenaire"
          title="Inscrivez votre restaurant"
          sub="Sans abonnement obligatoire"
          cta="Ouvrez votre vitrine"
          href="/devenir-partenaire"
          visual={<Visual emoji="🏪" />}
        />
        <PromoCard tone="lilac" badge="Réseau DineGo" title="Livrez avec DineGo, à votre rythme" sub="Rémunérations suivies en ligne" cta="Je deviens livreur" href="/devenir-livreur" visual={<Visual emoji="🏍️" />} />
      </Rail>

      {/* Plats à commander en deux clics */}
      <section className="space-y-4">
        <h2 className="text-lg font-extrabold tracking-tight text-violet sm:text-xl">
          Une envie ? <span className="text-orange-700">Deux clics</span> et c&apos;est servi.
        </h2>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto bg-cream px-4 py-2.5 sm:mx-0 sm:rounded-full sm:px-2.5 sm:ring-1 sm:ring-peach">
          {cats.slice(0, 10).map((c) => (
            <Link key={c.slug} href={`/restaurants?category=${c.slug}`} className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-violet shadow-sm transition hover:bg-lilac">
              <span aria-hidden>{c.icon}</span>
              {c.name}
            </Link>
          ))}
        </div>
        {dishes.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {dishes.slice(0, 8).map((d) => (
              <ProductCard key={d.id} p={d} restaurant={restoOf(d)} showRestaurant discount={discountOf.get(d.id)} />
            ))}
          </div>
        ) : (
          <Empty>Les premiers plats arrivent bientôt.</Empty>
        )}
        <div className="flex justify-center">
          <Link href="/restaurants" className="btn-outline bg-white">
            Encore plus de plats <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Adresses par quartier */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <form action="/restaurants" className="flex flex-1 items-center gap-2 rounded-full bg-white p-1.5 pl-4 shadow-[var(--shadow-soft)] ring-1 ring-line" role="search">
            <MapPin className="size-4 shrink-0 text-orange-600" aria-hidden />
            <label htmlFor="home-zone" className="sr-only">
              Ville ou quartier
            </label>
            <select id="home-zone" name="zone" defaultValue="" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none">
              <option value="">Ville, quartier…</option>
              {cities.map((c) => (
                <optgroup key={c} label={c}>
                  {(zones ?? [])
                    .filter((z) => z.city === c)
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <button className="btn-icon size-10 bg-orange text-violet-800 hover:bg-orange-500" aria-label="Rechercher dans ce quartier">
              <Search className="size-4" aria-hidden />
            </button>
          </form>
          <Link href="/devenir-partenaire" className="flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm shadow-[var(--shadow-soft)] ring-1 ring-line transition hover:ring-lilac-300">
            <Sparkles className="size-4 text-orange-600" aria-hidden />
            <span className="font-extrabold text-violet">DineGo Partenaire</span>
            <span className="font-semibold text-violet/70 underline underline-offset-2">Votre vitrine sans abonnement</span>
          </Link>
        </div>
        {restos.length ? (
          <Rail title={`${restos.length} bonne${restos.length > 1 ? "s" : ""} adresse${restos.length > 1 ? "s" : ""} à découvrir !`} href="/restaurants">
            {restos.slice(0, 12).map((r) => (
              <div key={r.id} className="w-[84%] shrink-0 snap-start sm:w-[calc(50%-6px)] xl:w-[calc(33.333%-8px)]">
                <RestaurantCard r={r} morph={false} />
              </div>
            ))}
          </Rail>
        ) : (
          <Empty>Les premiers restaurants partenaires arrivent bientôt.</Empty>
        )}
      </section>

      {topRated.length > 0 && (
        <Rail id="mieux-notes" title={<>Les <span className="text-orange-700">mieux notés</span> du moment</>} subtitle="Selon les avis des clients DineGo" href="/restaurants">
          {topRated.slice(0, 10).map((r) => (
            <div key={r.id} className="w-[84%] shrink-0 snap-start sm:w-[calc(50%-6px)] xl:w-[calc(33.333%-8px)]">
              <RestaurantCard r={r} morph={false} />
            </div>
          ))}
        </Rail>
      )}

      {grills.length > 2 && (
        <Rail title="Grillades et plats du maquis" href="/restaurants?category=grillades">
          {dishRail(grills)}
        </Rail>
      )}
      {sweets.length > 2 && (
        <Rail title="Douceurs et pâtisseries" href="/restaurants?category=patisseries">
          {dishRail(sweets)}
        </Rail>
      )}
      {drinks.length > 2 && (
        <Rail title="Jus locaux et boissons fraîches" href="/restaurants">
          {dishRail(drinks)}
        </Rail>
      )}

      {/* Bon à savoir */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          [Bike, "Livraison dès " + fcfa(fee?.delivery_fee ?? 500), "Par les livreurs du restaurant ou du réseau DineGo."],
          [Wallet, "Mobile Money ou espèces", "Orange Money, Moov Money, ou en espèces à la remise."],
          [Store, "Retrait sans frais", "Commandez en ligne, récupérez au comptoir."],
        ].map(([Icon, t, d]) => {
          const I = Icon as typeof Bike;
          return (
            <div key={t as string} className="flex items-start gap-3 rounded-3xl bg-white p-4 shadow-[var(--shadow-soft)] ring-1 ring-line/80">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange text-violet-800">
                <I className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-extrabold text-violet">{t as string}</span>
                <span className="text-sm text-muted">{d as string}</span>
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}
