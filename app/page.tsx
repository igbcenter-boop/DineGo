import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoHorizontal, LogoSymbol } from "@/components/Logo";
import { Carousel } from "@/components/Carousel";
import { Empty, RestaurantCard, Section } from "@/components/ui";
import { fcfa } from "@/lib/format";

const RESTO_FIELDS =
  "id, slug, name, city, cover_url, logo_url, rating_avg, rating_count, price_level, offers_delivery, offers_pickup, is_open, opens_at, closes_at, featured, categories(name, icon), zones(name)";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: categories }, { data: popular }, { data: latest }, { data: promos }, { data: dishes }, { data: fee }] = await Promise.all([
    supabase.from("categories").select("name, slug, icon").order("sort"),
    supabase.from("restaurants").select(RESTO_FIELDS).eq("status", "active").order("featured", { ascending: false }).order("rating_avg", { ascending: false }).limit(6),
    supabase.from("restaurants").select(RESTO_FIELDS).eq("status", "active").order("created_at", { ascending: false }).limit(6),
    supabase
      .from("promotions")
      .select("id, title, description, discount_percent, ends_at, restaurants!inner(name, slug, status)")
      .eq("active", true)
      .eq("restaurants.status", "active")
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
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

  return (
    <>
      {/* Bannières 27.3.1 et 27.3.2 */}
      <Carousel>
        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl md:min-h-[600px] md:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col justify-center gap-6 bg-violet px-4 py-12 sm:px-8 md:rounded-br-[48px]">
              <LogoHorizontal onDark size={34} />
              <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl">
                Toute la restauration du Burkina, <span className="text-orange">sur une seule plateforme.</span>
              </h1>
              <p className="max-w-lg text-white/85">
                Découvrez les menus, comparez les prix et commandez auprès des meilleurs établissements de votre ville.
              </p>
              <form action="/restaurants" className="flex max-w-xl gap-2 rounded-2xl bg-white p-2" role="search">
                <label htmlFor="home-q" className="sr-only">
                  Rechercher
                </label>
                <input id="home-q" name="q" placeholder="Un restaurant, un plat, un quartier…" className="w-full rounded-xl px-3 text-sm outline-none" />
                <button className="btn-primary">Trouver</button>
              </form>
              <p className="text-xs font-semibold tracking-[0.25em] text-white/75">CHOISISSEZ · COMMANDEZ · SAVOUREZ</p>
            </div>
            <div className="px-4 py-10 sm:px-8">
              <p className="mb-4 font-bold text-violet">Que voulez-vous manger aujourd&apos;hui ?</p>
              <div className="grid grid-cols-3 gap-3">
                {tiles.map((c, i) => (
                  <Link
                    key={c.slug}
                    href={`/restaurants?category=${c.slug}`}
                    className={`flex aspect-square flex-col justify-between rounded-2xl p-3 transition hover:-translate-y-0.5 ${
                      [0, 4].includes(i) ? "bg-violet text-white" : [1, 5].includes(i) ? "bg-peach text-violet" : "bg-lilac text-violet"
                    }`}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-orange text-xl" aria-hidden>
                      {c.icon}
                    </span>
                    <span className="text-sm font-bold">{c.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl md:min-h-[600px] md:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col justify-center gap-6 px-4 py-12 sm:px-8">
              <LogoHorizontal size={30} />
              <h2 className="text-4xl font-extrabold leading-tight text-violet sm:text-5xl">
                Livré chez vous ou prêt au comptoir. <span className="text-orange">À vous de choisir.</span>
              </h2>
              <p className="max-w-lg text-muted">Suivez votre commande en temps réel, de la cuisine du restaurant jusqu&apos;à votre porte. Payez par Mobile Money ou en espèces.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/restaurants" className="btn-primary">
                  Voir les restaurants
                </Link>
                <Link href="/devenir-partenaire" className="btn-outline">
                  Devenir partenaire
                </Link>
              </div>
            </div>
            <div className="relative hidden items-center justify-center overflow-hidden bg-violet md:flex md:rounded-l-full">
              <LogoSymbol size={220} />
              <span className="badge absolute left-10 top-16 bg-white px-3 py-1.5 text-violet">● Livraison à domicile</span>
              <span className="badge absolute bottom-24 right-8 bg-white px-3 py-1.5 text-violet">● Retrait sur place</span>
              <span className="badge absolute bottom-12 left-6 bg-orange px-3 py-1.5 text-violet-700">Mobile Money ou espèces</span>
            </div>
          </div>
        </section>
      </Carousel>

      <div className="container-dg mt-10 space-y-14">
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Choisissez", "Parcourez les restaurants, maquis et pâtisseries près de chez vous, sans créer de compte."],
            ["2", "Commandez", "Composez votre panier, choisissez la livraison ou le retrait et votre moyen de paiement."],
            ["3", "Savourez", "Suivez chaque étape en temps réel jusqu'à la remise de votre repas."],
          ].map(([n, t, d]) => (
            <div key={n} className="card flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange font-extrabold text-violet-700">{n}</span>
              <div>
                <p className="h3">{t}</p>
                <p className="text-sm text-muted">{d}</p>
              </div>
            </div>
          ))}
        </section>

        <Section title="Catégories de restauration">
          <div className="flex flex-wrap gap-2">
            {categories?.map((c) => (
              <Link key={c.slug} href={`/restaurants?category=${c.slug}`} className="chip px-4 py-2 text-sm hover:bg-lilac-200">
                <span className="mr-1" aria-hidden>
                  {c.icon}
                </span>
                {c.name}
              </Link>
            ))}
          </div>
        </Section>

        <Section title="Restaurants populaires et recommandés" action={<Link href="/restaurants" className="btn-ghost btn-sm">Tout voir →</Link>}>
          {popular?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {popular.map((r) => (
                // @ts-expect-error relations imbriquées
                <RestaurantCard key={r.id} r={r} />
              ))}
            </div>
          ) : (
            <Empty>Les premiers restaurants partenaires arrivent bientôt.</Empty>
          )}
        </Section>

        {!!promos?.length && (
          <section className="rounded-3xl bg-cream p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="h2">
                Les bons plans <span className="text-orange">du moment</span>
              </h2>
              <Link href="/promotions" className="btn-primary btn-sm">
                Voir toutes les offres
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {promos.map((p) => (
                // @ts-expect-error relation imbriquée
                <Link key={p.id} href={`/restaurants/${p.restaurants.slug}`} className="rounded-2xl bg-white p-4 shadow-sm hover:shadow-md">
                  <span className="badge bg-orange text-violet-700">-{p.discount_percent}%</span>
                  <p className="mt-2 font-bold text-violet">{p.title}</p>
                  {/* @ts-expect-error relation imbriquée */}
                  <p className="text-xs text-muted">{p.restaurants.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!!dishes?.length && (
          <Section title="Les plats les plus consultés">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {dishes.map((d) => (
                // @ts-expect-error relation imbriquée
                <Link key={d.id} href={`/restaurants/${d.restaurants.slug}#p-${d.id}`} className="overflow-hidden rounded-2xl border border-line bg-white hover:shadow-md">
                  <div className="grid h-28 place-items-center bg-lilac text-4xl">
                    {d.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden>🍽️</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-bold text-violet">{d.name}</p>
                    {/* @ts-expect-error relation imbriquée */}
                    <p className="text-xs text-muted">{d.restaurants.name}</p>
                    <p className="price mt-1 text-sm">{fcfa(d.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {!!latest?.length && (
          <Section title="Restaurants disponibles">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {latest.map((r) => (
                // @ts-expect-error relations imbriquées
                <RestaurantCard key={r.id} r={r} />
              ))}
            </div>
          </Section>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h2 className="h2 mb-2">Infos livraison</h2>
            <ul className="space-y-2 text-sm text-ink">
              <li>🛵 Livraison par les livreurs du restaurant ou du réseau DineGo, selon votre zone.</li>
              <li>💰 Frais de livraison à partir de {fcfa(fee?.delivery_fee ?? 500)}, affichés avant validation.</li>
              <li>🏪 Retrait sur place sans frais de livraison.</li>
              <li>📱 Paiement Orange Money, Moov Money ou en espèces à la livraison ou au retrait.</li>
            </ul>
          </div>
          <div className="card flex flex-col justify-between gap-4 bg-lilac/50">
            <div>
              <h2 className="h2 mb-2">Rejoignez DineGo</h2>
              <p className="text-sm text-muted">Consultez librement. Un compte est simplement demandé au moment de valider votre commande.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/inscription" className="btn-primary">
                Créer un compte
              </Link>
              <Link href="/connexion" className="btn-outline">
                Se connecter
              </Link>
              <Link href="/devenir-partenaire" className="btn-ghost">
                Restaurateur ?
              </Link>
              <Link href="/devenir-livreur" className="btn-ghost">
                Livreur ?
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
