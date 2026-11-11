import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoHorizontal } from "@/components/Logo";
import { Banner, BannerChips } from "@/components/Banner";
import { AddToCart } from "@/components/CartWidgets";
import { Empty, Stars } from "@/components/ui";
import { PRICE_LEVEL, dateOnly, fcfa, isOpenNow } from "@/lib/format";

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurants")
    .select("*, categories(name, icon), zones(name, city)")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata(props: PageProps<"/restaurants/[slug]">): Promise<Metadata> {
  const r = await load((await props.params).slug);
  return { title: r?.name ?? "Restaurant", description: r?.description ?? undefined };
}

export default async function RestaurantPage(props: PageProps<"/restaurants/[slug]">) {
  const { slug } = await props.params;
  const r = await load(slug);
  if (!r) notFound();
  const supabase = await createClient();
  const [{ data: sections }, { data: products }, { data: promos }, { data: reviews }] = await Promise.all([
    supabase.from("menu_categories").select("id, name, sort").eq("restaurant_id", r.id).order("sort"),
    supabase.from("products").select("*").eq("restaurant_id", r.id).order("name"),
    supabase
      .from("promotions")
      .select("*")
      .eq("restaurant_id", r.id)
      .eq("active", true)
      .lte("starts_at", new Date().toISOString())
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`),
    supabase.from("reviews").select("*").eq("restaurant_id", r.id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (products?.length) await supabase.rpc("increment_product_views", { pids: products.map((p) => p.id) });

  const open = isOpenNow(r);
  const resto = { id: r.id, name: r.name, slug: r.slug };
  const groups = [
    ...(sections ?? []).map((s) => ({ id: s.id, name: s.name, items: (products ?? []).filter((p) => p.menu_category_id === s.id) })),
    { id: "autres", name: "Autres", items: (products ?? []).filter((p) => !p.menu_category_id) },
  ].filter((g) => g.items.length);
  const promoByProduct = new Map((promos ?? []).filter((p) => p.product_id).map((p) => [p.product_id, p]));
  const pending = r.status !== "active";

  return (
    <>
      {/* Bannière 27.3.4 — générée automatiquement pour chaque restaurant */}
      <section className="bg-violet text-white">
        <div className="relative h-44 overflow-hidden bg-violet-700 sm:h-56">
          {r.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.cover_url} alt={`Photo de couverture de ${r.name}`} className="h-full w-full object-cover opacity-80" />
          ) : (
            <div className="h-full w-full bg-[repeating-linear-gradient(135deg,#3a1155_0_18px,#4b176d_18px_36px)]" />
          )}
          <div className="absolute inset-x-0 top-0 mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <LogoHorizontal onDark size={28} />
            <nav aria-label="Fil d'Ariane" className="hidden text-xs text-white/85 sm:block">
              <Link href="/">Accueil</Link> › <Link href="/restaurants">Restaurants</Link> › {r.name}
            </nav>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-6 sm:flex-row sm:items-end sm:px-6">
          <div className="-mt-14 grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-white text-5xl shadow-lg">
            {r.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.logo_url} alt={`Logo de ${r.name}`} className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>{r.categories?.icon ?? "🍽️"}</span>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <h1 className="text-3xl font-extrabold">{r.name}</h1>
            <p className="text-sm text-white/85">
              {r.categories?.name ?? "Restaurant"} · {r.city}
              {r.zones?.name ? `, quartier ${r.zones.name}` : ""} · {PRICE_LEVEL[r.price_level]}
              {r.rating_count > 0 && (
                <>
                  {" · "}
                  <span className="text-orange">★ {Number(r.rating_avg).toFixed(1).replace(".", ",")}</span> ({r.rating_count} avis)
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="chip-on-dark">{open ? "Ouvert" : "Fermé"}{r.opens_at && r.closes_at ? ` · ${r.opens_at.slice(0, 5)}–${r.closes_at.slice(0, 5)}` : ""}</span>
              {r.offers_delivery && <span className="chip-on-dark">Livraison</span>}
              {r.offers_pickup && <span className="chip-on-dark">Retrait sur place</span>}
            </div>
          </div>
          <a href="#menu" className="btn-primary">
            Voir le menu
          </a>
        </div>
      </section>

      {pending && (
        <p className="container-dg mt-4 rounded-xl bg-peach px-4 py-3 text-sm font-semibold text-orange-700">
          Aperçu : cet établissement n&apos;est pas encore visible du public (statut : {r.status}).
        </p>
      )}

      <div className="container-dg mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <h2 className="h2">Présentation</h2>
          <p className="whitespace-pre-line text-sm text-ink">{r.description || "Ce restaurant n'a pas encore ajouté de présentation."}</p>
          {!!promos?.length && (
            <div className="grid gap-2 sm:grid-cols-2">
              {promos.map((p) => (
                <div key={p.id} className="rounded-2xl bg-cream p-4">
                  <span className="badge bg-orange text-violet-700">-{p.discount_percent}%</span>
                  <p className="mt-1 font-bold text-violet">{p.title}</p>
                  <p className="text-xs text-muted">{p.conditions}{p.ends_at ? ` · jusqu'au ${dateOnly(p.ends_at)}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <aside className="card space-y-2 text-sm">
          <p><strong className="text-violet">Adresse :</strong> {r.address}, {r.city}</p>
          <p><strong className="text-violet">Contact :</strong> <a href={`tel:${r.phone}`} className="underline">{r.phone}</a></p>
          <p><strong className="text-violet">Horaires :</strong> {r.opening_hours || (r.opens_at ? `${r.opens_at.slice(0, 5)} – ${r.closes_at?.slice(0, 5)}` : "Non précisés")}</p>
          {r.offers_delivery && <p><strong className="text-violet">Zone de livraison :</strong> {r.delivery_zones || r.zones?.name || r.city}</p>}
          {r.delivery_conditions && <p><strong className="text-violet">Conditions :</strong> {r.delivery_conditions}</p>}
          {r.accepts_reservations && (
            <Link href={`/reservation?restaurant=${r.slug}`} className="btn-outline btn-sm mt-2">
              Réserver une table
            </Link>
          )}
        </aside>
      </div>

      <div id="menu" className="mt-10 scroll-mt-20">
        <Banner
          tone="cream"
          crumbs={[{ label: "Restaurants", href: "/restaurants" }, { label: r.name }, { label: "Menu" }]}
          title="Composez votre repas,"
          highlight="plat par plat."
          text="Entrées, plats, grillades, desserts, boissons : ajoutez au panier, ajustez les quantités et les options."
          illustration="bag"
        >
          <BannerChips items={groups.map((g) => ({ label: g.name, href: `#cat-${g.id}` }))} />
        </Banner>
      </div>

      <div className="container-dg mt-8 space-y-10">
        {groups.length === 0 && <Empty>Le menu de ce restaurant sera bientôt disponible.</Empty>}
        {groups.map((g) => (
          <section key={g.id} id={`cat-${g.id}`} className="scroll-mt-20">
            <h2 className="h2 mb-4">{g.name}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {g.items.map((p) => {
                const promo = promoByProduct.get(p.id);
                return (
                  <article key={p.id} id={`p-${p.id}`} className={`flex gap-4 rounded-2xl border border-line bg-white p-3 ${p.available ? "" : "opacity-60"}`}>
                    <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-lilac text-3xl">
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <span aria-hidden>🍽️</span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-violet">{p.name}</h3>
                        <span className="price whitespace-nowrap text-sm">{fcfa(p.price)}</span>
                      </div>
                      {p.description && <p className="text-xs text-muted">{p.description}</p>}
                      {promo && <span className="badge w-fit bg-orange text-violet-700">-{promo.discount_percent}% · {promo.title}</span>}
                      {!!p.options?.length && <p className="text-xs text-muted">Options : {p.options.map((o: { name: string }) => o.name).join(", ")}</p>}
                      <div className="mt-auto pt-1">
                        <AddToCart restaurant={resto} product={{ id: p.id, name: p.name, price: p.price, options: p.options ?? [] }} disabled={!p.available || pending} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <section>
          <h2 className="h2 mb-4">Avis et évaluations {r.rating_count > 0 && <Stars value={r.rating_avg} count={r.rating_count} />}</h2>
          {reviews?.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {reviews.map((v) => (
                <li key={v.id} className="card">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-violet">{v.author_name || "Client DineGo"}</p>
                    <span className="text-orange" aria-label={`${v.rating_restaurant} sur 5`}>
                      {"★".repeat(v.rating_restaurant)}
                      <span className="text-line">{"★".repeat(5 - v.rating_restaurant)}</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted">Service : {v.rating_service}/5 · {dateOnly(v.created_at)}</p>
                  {v.comment && <p className="mt-2 text-sm">{v.comment}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Pas encore d&apos;avis. Commandez et partagez le vôtre !</Empty>
          )}
        </section>
      </div>
    </>
  );
}
