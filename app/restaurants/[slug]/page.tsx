import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bike, CalendarDays, ChevronRight, Clock, MapPin, Phone, Star, Store, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoHorizontal } from "@/components/Logo";
import { Banner } from "@/components/Banner";
import { AddToCart } from "@/components/CartWidgets";
import { MenuTabs } from "@/components/MenuTabs";
import { Cover, Empty, Stars } from "@/components/ui";
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
  const now = new Date().toISOString();
  const [{ data: sections }, { data: products }, { data: promos }, { data: reviews }] = await Promise.all([
    supabase.from("menu_categories").select("id, name, sort").eq("restaurant_id", r.id).order("sort"),
    supabase.from("products").select("*").eq("restaurant_id", r.id).order("name"),
    supabase.from("promotions").select("*").eq("restaurant_id", r.id).eq("active", true).lte("starts_at", now).or(`ends_at.is.null,ends_at.gt.${now}`),
    supabase.from("reviews").select("*").eq("restaurant_id", r.id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (products?.length) await supabase.rpc("increment_product_views", { pids: products.map((p) => p.id) });

  const open = isOpenNow(r);
  const resto = { id: r.id, name: r.name, slug: r.slug };
  const groups = [
    ...(sections ?? []).map((s) => ({ id: s.id as string, name: s.name as string, items: (products ?? []).filter((p) => p.menu_category_id === s.id) })),
    { id: "autres", name: "Autres", items: (products ?? []).filter((p) => !p.menu_category_id) },
  ].filter((g) => g.items.length);
  const promoByProduct = new Map((promos ?? []).filter((p) => p.product_id).map((p) => [p.product_id, p]));
  const pending = r.status !== "active";
  const hours = r.opens_at && r.closes_at ? `${r.opens_at.slice(0, 5)} – ${r.closes_at.slice(0, 5)}` : null;

  return (
    <>
      {/* Bannière 27.3.4 — générée automatiquement pour chaque restaurant */}
      <section className="container-dg pt-4 sm:pt-6">
        <div className="relative overflow-hidden rounded-[28px] bg-violet text-white sm:rounded-[36px]">
          <div className="relative">
            <Cover r={r} className="h-48 sm:h-64" />
            <div className="absolute inset-0 bg-gradient-to-b from-violet-900/55 via-transparent to-violet/95" aria-hidden />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-4 sm:px-8">
              <LogoHorizontal onDark size={28} />
              <nav aria-label="Fil d'Ariane" className="hidden items-center gap-1 text-xs text-white/80 sm:flex">
                <Link href="/" className="hover:text-white">Accueil</Link>
                <ChevronRight className="size-3 text-white/40" aria-hidden />
                <Link href="/restaurants" className="hover:text-white">Restaurants</Link>
                <ChevronRight className="size-3 text-white/40" aria-hidden />
                <span className="text-white">{r.name}</span>
              </nav>
            </div>
          </div>
          <div className="relative flex flex-col gap-5 px-5 pb-6 sm:flex-row sm:items-end sm:px-8 sm:pb-8">
            <div className="-mt-16 grid size-28 shrink-0 place-items-center overflow-hidden rounded-3xl bg-white text-5xl shadow-[var(--shadow-lift)] ring-4 ring-violet">
              {r.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.logo_url} alt={`Logo de ${r.name}`} className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden>{r.categories?.icon ?? "🍽️"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="text-[28px] leading-tight font-extrabold tracking-tight sm:text-4xl">{r.name}</h1>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-white/80">
                <span className="font-semibold text-white">{r.categories?.name ?? "Restaurant"}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 text-orange" aria-hidden />
                  {r.zones?.name ? `${r.zones.name}, ` : ""}
                  {r.city}
                </span>
                <span>{PRICE_LEVEL[r.price_level]}</span>
                {r.rating_count > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5">
                    <Star className="size-3.5 fill-orange text-orange" aria-hidden />
                    <strong className="text-white">{Number(r.rating_avg).toFixed(1).replace(".", ",")}</strong> ({r.rating_count} avis)
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className={`chip-on-dark ${open ? "" : "bg-red-500/30"}`}>
                  <span className={`size-1.5 rounded-full ${open ? "bg-emerald-400" : "bg-red-400"}`} aria-hidden />
                  {open ? "Ouvert" : "Fermé"}
                  {hours ? ` · ${hours}` : ""}
                </span>
                {r.offers_delivery && (
                  <span className="chip-on-dark"><Bike className="size-3.5" aria-hidden /> Livraison</span>
                )}
                {r.offers_pickup && (
                  <span className="chip-on-dark"><Store className="size-3.5" aria-hidden /> Retrait sur place</span>
                )}
              </div>
            </div>
            <a href="#menu" className="btn-primary">
              Voir le menu
            </a>
          </div>
        </div>
      </section>

      <div className="container-dg">
        {pending && (
          <p className="mt-4 rounded-2xl bg-peach px-4 py-3 text-sm font-semibold text-orange-700">
            Aperçu : cet établissement n&apos;est pas encore visible du public (statut : {r.status}).
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div>
              <p className="eyebrow mb-1">À propos</p>
              <h2 className="h2">Présentation</h2>
            </div>
            <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink/85">{r.description || "Ce restaurant n'a pas encore ajouté de présentation."}</p>
            {!!promos?.length && (
              <div className="grid gap-3 sm:grid-cols-2">
                {promos.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 rounded-3xl bg-cream p-4 ring-1 ring-peach">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange text-sm font-extrabold text-violet-800">-{p.discount_percent}%</span>
                    <div>
                      <p className="font-bold text-violet">{p.title}</p>
                      <p className="text-xs text-muted">
                        {p.conditions}
                        {p.ends_at ? ` · jusqu'au ${dateOnly(p.ends_at)}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <aside className="card space-y-3.5 text-sm">
            <p className="flex items-start gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden /> <span>{r.address}, {r.city}</span></p>
            <p className="flex items-start gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden /> <a href={`tel:${r.phone}`} className="font-semibold text-violet underline-offset-2 hover:underline">{r.phone}</a></p>
            <p className="flex items-start gap-3"><Clock className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden /> <span>{r.opening_hours || hours || "Horaires non précisés"}</span></p>
            {r.offers_delivery && (
              <p className="flex items-start gap-3"><Bike className="mt-0.5 size-4 shrink-0 text-orange" aria-hidden /> <span>Zone : {r.delivery_zones || r.zones?.name || r.city}{r.delivery_conditions ? ` · ${r.delivery_conditions}` : ""}</span></p>
            )}
            {r.accepts_reservations && (
              <Link href={`/reservation?restaurant=${r.slug}`} className="btn-outline btn-sm w-full">
                <CalendarDays className="size-4" aria-hidden /> Réserver une table
              </Link>
            )}
          </aside>
        </div>
      </div>

      <div id="menu" className="mt-12">
        <Banner
          tone="cream"
          crumbs={[{ label: "Restaurants", href: "/restaurants" }, { label: r.name }, { label: "Menu" }]}
          title="Composez votre repas,"
          highlight="plat par plat."
          text="Entrées, plats, grillades, desserts, boissons : ajoutez au panier, ajustez les quantités et les options."
          illustration="bag"
        />
      </div>

      <div className="container-dg mt-6 space-y-10">
        <MenuTabs items={groups.map((g) => ({ id: g.id, name: g.name, count: g.items.length }))} />
        {groups.length === 0 && <Empty>Le menu de ce restaurant sera bientôt disponible.</Empty>}
        {groups.map((g) => (
          <section key={g.id} id={`cat-${g.id}`} className="scroll-mt-36">
            <h2 className="h2 mb-4">{g.name}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {g.items.map((p) => {
                const promo = promoByProduct.get(p.id);
                return (
                  <article
                    key={p.id}
                    id={`p-${p.id}`}
                    className={`flex scroll-mt-36 gap-4 rounded-3xl bg-white p-3 shadow-[var(--shadow-soft)] ring-1 ring-line/80 transition hover:ring-lilac-300 ${p.available ? "" : "opacity-55"}`}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1 pl-1">
                      <h3 className="font-bold text-ink">{p.name}</h3>
                      {p.description && <p className="line-clamp-2 text-xs leading-relaxed text-muted">{p.description}</p>}
                      {!!p.options?.length && <p className="line-clamp-1 text-[11px] text-violet/60">Options : {p.options.map((o: { name: string }) => o.name).join(", ")}</p>}
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                        <span className="price">{fcfa(p.price)}</span>
                        {promo && (
                          <span className="badge bg-orange text-violet-800">
                            <Tag className="size-3" aria-hidden />-{promo.discount_percent}%
                          </span>
                        )}
                        {p.is_combo && <span className="badge bg-lilac text-violet">Menu</span>}
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <div className="grid size-28 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-lilac to-peach text-4xl sm:size-32">
                        {p.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photo_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span aria-hidden>🍽️</span>
                        )}
                      </div>
                      <div className="absolute -right-1 -bottom-1 flex flex-row-reverse items-center gap-2">
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
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow mb-1">Ils ont goûté</p>
              <h2 className="h2">Avis et évaluations</h2>
            </div>
            {r.rating_count > 0 && <Stars value={r.rating_avg} count={r.rating_count} />}
          </div>
          {reviews?.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {reviews.map((v) => (
                <li key={v.id} className="card">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-bold text-violet">
                      <span className="grid size-8 place-items-center rounded-full bg-lilac text-xs">{(v.author_name || "C").charAt(0)}</span>
                      {v.author_name || "Client DineGo"}
                    </p>
                    <span className="flex" aria-label={`${v.rating_restaurant} sur 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`size-4 ${n <= v.rating_restaurant ? "fill-orange text-orange" : "text-lilac-300"}`} aria-hidden />
                      ))}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">Service : {v.rating_service}/5 · {dateOnly(v.created_at)}</p>
                  {v.comment && <p className="mt-3 text-sm leading-relaxed">{v.comment}</p>}
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
