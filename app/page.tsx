import Link from "next/link";
import { ArrowRight, Bike, ChefHat, Search, Smartphone, Sparkles, Store, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoHorizontal, LogoSymbol } from "@/components/Logo";
import { Carousel } from "@/components/Carousel";
import { Empty, RestaurantCard, Section, type RestaurantCardData } from "@/components/ui";
import { fcfa } from "@/lib/format";

const RESTO_FIELDS =
  "id, slug, name, city, cover_url, logo_url, rating_avg, rating_count, price_level, offers_delivery, offers_pickup, is_open, opens_at, closes_at, featured, categories(name, icon), zones(name)";

export default async function Home() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: categories }, { data: popular }, { data: latest }, { data: promos }, { data: dishes }, { data: fee }] = await Promise.all([
    supabase.from("categories").select("name, slug, icon").order("sort"),
    supabase.from("restaurants").select(RESTO_FIELDS).eq("status", "active").order("featured", { ascending: false }).order("rating_avg", { ascending: false }).limit(8),
    supabase.from("restaurants").select(RESTO_FIELDS).eq("status", "active").order("created_at", { ascending: false }).limit(6),
    supabase
      .from("promotions")
      .select("id, title, conditions, discount_percent, ends_at, restaurants!inner(name, slug, status)")
      .eq("active", true)
      .eq("restaurants.status", "active")
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .limit(4),
    supabase
      .from("products")
      .select("id, name, price, photo_url, views, restaurants!inner(name, slug, status)")
      .eq("available", true)
      .eq("restaurants.status", "active")
      .order("views", { ascending: false })
      .limit(8),
    supabase.from("public_fees").select("delivery_fee").maybeSingle(),
  ]);

  const tiles = ["maquis", "grillades", "fast-foods", "pizzerias", "patisseries", "cafes"]
    .map((s) => categories?.find((c) => c.slug === s))
    .filter(Boolean) as { name: string; slug: string; icon: string }[];
  const popularList = (popular ?? []) as unknown as RestaurantCardData[];
  const latestList = (latest ?? []) as unknown as RestaurantCardData[];

  return (
    <>
      {/* Bannières 27.3.1 et 27.3.2 */}
      <section className="container-dg pt-4 sm:pt-6">
        <Carousel>
          <div className="grid overflow-hidden rounded-[28px] bg-white ring-1 ring-line sm:rounded-[36px] md:min-h-[600px] md:grid-cols-[1.15fr_1fr]">
            <div className="relative isolate flex flex-col justify-center gap-6 overflow-hidden bg-violet px-6 py-10 sm:px-10 md:rounded-r-[48px]">
              <div className="pattern-dots absolute inset-0 -z-10" aria-hidden />
              <div className="absolute -bottom-24 -left-20 -z-10 size-80 rounded-full bg-orange/25 blur-3xl" aria-hidden />
              <LogoHorizontal onDark size={34} />
              <h1 className="animate-fade-up text-[34px] leading-[1.05] font-extrabold tracking-tight text-balance text-white sm:text-5xl">
                Toute la restauration du Burkina, <span className="text-orange">sur une seule plateforme.</span>
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-white/80">
                Découvrez les menus, comparez les prix et commandez auprès des meilleurs établissements de votre ville.
              </p>
              <form action="/restaurants" className="flex max-w-xl items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-[var(--shadow-lift)]" role="search">
                <Search className="size-5 shrink-0 text-violet-300" aria-hidden />
                <label htmlFor="home-q" className="sr-only">
                  Rechercher
                </label>
                <input id="home-q" name="q" placeholder="Un restaurant, un plat, un quartier…" className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted" />
                <button className="btn-primary shrink-0">Trouver</button>
              </form>
              <p className="text-[11px] font-bold tracking-[0.3em] text-white/60">CHOISISSEZ · COMMANDEZ · SAVOUREZ</p>
            </div>
            <div className="flex flex-col justify-center px-6 py-8 sm:px-10">
              <p className="eyebrow mb-1">Envie de quoi ?</p>
              <p className="mb-5 text-xl font-extrabold tracking-tight text-violet">Que voulez-vous manger aujourd&apos;hui ?</p>
              <div className="grid grid-cols-3 gap-3">
                {tiles.map((c, i) => (
                  <Link
                    key={c.slug}
                    href={`/restaurants?category=${c.slug}`}
                    className={`group card-hover flex aspect-square flex-col justify-between rounded-3xl p-3 sm:p-4 ${
                      [0, 4].includes(i) ? "bg-violet text-white" : [1, 5].includes(i) ? "bg-peach text-violet" : "bg-lilac text-violet"
                    }`}
                  >
                    <span className="grid size-11 place-items-center rounded-2xl bg-orange text-2xl shadow-sm transition-transform group-hover:scale-110 group-hover:-rotate-6" aria-hidden>
                      {c.icon}
                    </span>
                    <span className="text-sm font-bold">{c.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="grid overflow-hidden rounded-[28px] bg-white ring-1 ring-line sm:rounded-[36px] md:min-h-[600px] md:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col justify-center gap-6 px-6 py-10 sm:px-10">
              <LogoHorizontal size={30} />
              <h2 className="text-[34px] leading-[1.05] font-extrabold tracking-tight text-balance text-violet sm:text-5xl">
                Livré chez vous ou prêt au comptoir. <span className="text-orange">À vous de choisir.</span>
              </h2>
              <p className="max-w-md text-[15px] leading-relaxed text-muted">
                Suivez votre commande en temps réel, de la cuisine du restaurant jusqu&apos;à votre porte. Payez par Mobile Money ou en espèces.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/restaurants" className="btn-primary">
                  Voir les restaurants <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/devenir-partenaire" className="btn-outline">
                  Devenir partenaire
                </Link>
              </div>
            </div>
            <div className="relative hidden items-center justify-center overflow-hidden bg-violet md:flex md:rounded-l-[200px]">
              <div className="pattern-dots absolute inset-0" aria-hidden />
              <div className="relative drop-shadow-[0_30px_40px_rgba(34,8,47,0.45)]">
                <LogoSymbol size={210} />
              </div>
              <span className="badge absolute top-20 left-14 bg-white px-3.5 py-2 text-violet shadow-lg">
                <Bike className="size-4 text-orange" aria-hidden /> Livraison à domicile
              </span>
              <span className="badge absolute right-10 bottom-28 bg-white px-3.5 py-2 text-violet shadow-lg">
                <Store className="size-4 text-orange" aria-hidden /> Retrait sur place
              </span>
              <span className="badge absolute bottom-14 left-10 bg-orange px-3.5 py-2 text-violet-800 shadow-lg">
                <Wallet className="size-4" aria-hidden /> Mobile Money ou espèces
              </span>
            </div>
          </div>
        </Carousel>
      </section>

      <div className="container-dg mt-12 space-y-16">
        <section aria-label="Catégories de restauration">
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {categories?.map((c) => (
              <Link
                key={c.slug}
                href={`/restaurants?category=${c.slug}`}
                className="group flex shrink-0 items-center gap-2 rounded-full bg-white py-1.5 pr-4 pl-1.5 text-sm font-semibold text-violet shadow-[var(--shadow-soft)] ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-lilac-300"
              >
                <span className="grid size-8 place-items-center rounded-full bg-lilac text-base transition-transform group-hover:scale-110" aria-hidden>
                  {c.icon}
                </span>
                {c.name}
              </Link>
            ))}
          </div>
        </section>

        <Section
          eyebrow="Les favoris"
          title="Restaurants populaires et recommandés"
          action={
            <Link href="/restaurants" className="btn-ghost btn-sm">
              Tout voir <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
        >
          {popularList.length ? (
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {popularList.map((r) => (
                <div key={r.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
                  <RestaurantCard r={r} />
                </div>
              ))}
            </div>
          ) : (
            <Empty>Les premiers restaurants partenaires arrivent bientôt.</Empty>
          )}
        </Section>

        {!!promos?.length && (
          <section className="relative isolate overflow-hidden rounded-[32px] bg-cream p-6 ring-1 ring-peach sm:p-10">
            <div className="pattern-dots-violet absolute inset-0 -z-10" aria-hidden />
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow mb-1">Promotions</p>
                <h2 className="h2 text-2xl sm:text-3xl">
                  Les bons plans <span className="text-orange">du moment</span>
                </h2>
              </div>
              <Link href="/promotions" className="btn-primary btn-sm">
                Voir toutes les offres
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {promos.map((p) => {
                const r = p.restaurants as unknown as { name: string; slug: string };
                return (
                  <Link key={p.id} href={`/restaurants/${r.slug}`} className="card-hover flex flex-col gap-2 rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)]">
                    <span className="w-fit rounded-2xl bg-orange px-3 py-1.5 text-lg font-extrabold text-violet-800">-{p.discount_percent}%</span>
                    <p className="font-bold text-violet">{p.title}</p>
                    <p className="mt-auto text-xs text-muted">{r.name}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {!!dishes?.length && (
          <Section eyebrow="Tendances" title="Les plats les plus consultés">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {dishes.map((d) => {
                const r = d.restaurants as unknown as { name: string; slug: string };
                return (
                  <Link key={d.id} href={`/restaurants/${r.slug}#p-${d.id}`} className="group card-hover overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-soft)] ring-1 ring-line/80">
                    <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-gradient-to-br from-lilac to-peach text-5xl">
                      {d.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.photo_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <span className="transition-transform duration-300 group-hover:scale-110" aria-hidden>
                          🍽️
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 p-3.5">
                      <p className="line-clamp-1 text-sm font-bold text-violet">{d.name}</p>
                      <p className="line-clamp-1 text-xs text-muted">{r.name}</p>
                      <p className="price pt-1 text-sm">{fcfa(d.price)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Section>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            [Search, "Choisissez", "Parcourez les restaurants, maquis et pâtisseries près de chez vous, sans créer de compte."],
            [ChefHat, "Commandez", "Composez votre panier, choisissez livraison ou retrait et votre moyen de paiement."],
            [Sparkles, "Savourez", "Suivez chaque étape en temps réel jusqu'à la remise de votre repas."],
          ].map(([Icon, t, d], i) => {
            const I = Icon as typeof Search;
            return (
              <div key={t as string} className="card relative overflow-hidden">
                <span className="absolute -top-3 right-3 text-[88px] leading-none font-extrabold text-lilac select-none" aria-hidden>
                  {i + 1}
                </span>
                <span className="relative mb-4 grid size-12 place-items-center rounded-2xl bg-orange text-violet-800 shadow-[var(--shadow-glow)]">
                  <I className="size-6" aria-hidden />
                </span>
                <p className="relative h3 text-lg">{t as string}</p>
                <p className="relative mt-1 text-sm leading-relaxed text-muted">{d as string}</p>
              </div>
            );
          })}
        </section>

        {latestList.length > 0 && (
          <Section eyebrow="Nouveautés" title="Restaurants disponibles">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {latestList.map((r) => (
                <RestaurantCard key={r.id} r={r} morph={!popularList.some((x) => x.id === r.id)} />
              ))}
            </div>
          </Section>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <p className="eyebrow mb-1">Bon à savoir</p>
            <h2 className="h2 mb-4">Infos livraison</h2>
            <ul className="space-y-3 text-sm">
              {[
                [Bike, "Livraison par les livreurs du restaurant ou du réseau DineGo, selon votre zone."],
                [Wallet, `Frais de livraison à partir de ${fcfa(fee?.delivery_fee ?? 500)}, affichés avant validation.`],
                [Store, "Retrait sur place sans frais de livraison."],
                [Smartphone, "Paiement Orange Money, Moov Money ou en espèces."],
              ].map(([Icon, t]) => {
                const I = Icon as typeof Bike;
                return (
                  <li key={t as string} className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lilac text-violet">
                      <I className="size-4.5" aria-hidden />
                    </span>
                    <span className="pt-2">{t as string}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="relative isolate flex flex-col justify-between gap-6 overflow-hidden rounded-3xl bg-violet p-6 text-white sm:p-8">
            <div className="pattern-dots absolute inset-0 -z-10" aria-hidden />
            <div className="absolute -right-16 -bottom-16 -z-10 size-56 rounded-full bg-orange/30 blur-3xl" aria-hidden />
            <div>
              <p className="eyebrow mb-1 text-orange">Rejoignez DineGo</p>
              <h2 className="text-2xl font-extrabold tracking-tight">Consultez librement, commandez en un clin d&apos;œil.</h2>
              <p className="mt-2 text-sm text-white/75">Un compte est simplement demandé au moment de valider votre commande.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/inscription" className="btn-primary">
                Créer un compte
              </Link>
              <Link href="/devenir-partenaire" className="btn-outline-light">
                Restaurateur ?
              </Link>
              <Link href="/devenir-livreur" className="btn-outline-light">
                Livreur ?
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
