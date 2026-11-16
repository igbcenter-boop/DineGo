import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/Banner";
import { Empty, RestaurantCard, type RestaurantCardData } from "@/components/ui";
import { isOpenNow } from "@/lib/format";

export const metadata: Metadata = { title: "Restaurants" };

const FIELDS =
  "id, slug, name, city, cover_url, logo_url, rating_avg, rating_count, price_level, offers_delivery, offers_pickup, is_open, opens_at, closes_at, cuisine_type, categories(name, icon, slug), zones(name)";

export default async function RestaurantsPage(props: PageProps<"/restaurants">) {
  const sp = await props.searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const q = get("q");
  const city = get("city");
  const zone = get("zone");
  const category = get("category");
  const cuisine = get("cuisine");
  const price = get("price");
  const mode = get("mode");
  const openNow = get("open") === "1";

  const supabase = await createClient();
  const [{ data: categories }, { data: zones }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, icon").order("sort"),
    supabase.from("zones").select("id, city, name").order("city").order("name"),
  ]);
  const cities = [...new Set((zones ?? []).map((z) => z.city))];

  let query = supabase.from("restaurants").select(FIELDS).eq("status", "active");
  if (q) {
    const like = `%${q.replace(/[%,()]/g, " ")}%`;
    // Recherche par nom, cuisine, ville, quartier ou plat
    const [{ data: byDish }, { data: byZone }] = await Promise.all([
      supabase.from("products").select("restaurant_id").ilike("name", like).limit(200),
      supabase.from("zones").select("id").ilike("name", like),
    ]);
    const ids = [...new Set((byDish ?? []).map((p) => p.restaurant_id))];
    const zoneIds = (byZone ?? []).map((z) => z.id);
    const ors = [`name.ilike.${like}`, `cuisine_type.ilike.${like}`, `city.ilike.${like}`, `address.ilike.${like}`];
    if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
    if (zoneIds.length) ors.push(`zone_id.in.(${zoneIds.join(",")})`);
    query = query.or(ors.join(","));
  }
  if (city) query = query.eq("city", city);
  if (zone) query = query.eq("zone_id", zone);
  if (category) {
    const cat = categories?.find((c) => c.slug === category);
    if (cat) query = query.eq("category_id", cat.id);
  }
  if (cuisine) query = query.ilike("cuisine_type", `%${cuisine}%`);
  if (price) query = query.eq("price_level", Number(price));
  if (mode === "delivery") query = query.eq("offers_delivery", true);
  if (mode === "pickup") query = query.eq("offers_pickup", true);

  const { data } = await query.order("featured", { ascending: false }).order("rating_avg", { ascending: false }).limit(60);
  let list = (data ?? []) as unknown as RestaurantCardData[];
  if (openNow) list = list.filter(isOpenNow);

  // Lien qui ajoute / retire un filtre en gardant les autres
  const current: Record<string, string> = { q, city, zone, category, cuisine, price, mode, open: openNow ? "1" : "" };
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...current, ...patch }).filter(([, v]) => v));
    const s = p.toString();
    return `/restaurants${s ? `?${s}` : ""}`;
  };
  const activeCount = [zone, category, cuisine, price, mode, openNow ? "1" : ""].filter(Boolean).length;

  const filters = (
    <form className="space-y-4 text-sm" aria-label="Filtres">
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="city" value={city} />
      <div>
        <label className="label" htmlFor="f-zone">Quartier / zone</label>
        <select id="f-zone" name="zone" defaultValue={zone} className="input">
          <option value="">Tous</option>
          {(zones ?? [])
            .filter((z) => !city || z.city === city)
            .map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} ({z.city})
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-cat">Catégorie</label>
        <select id="f-cat" name="category" defaultValue={category} className="input">
          <option value="">Toutes</option>
          {categories?.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-cuisine">Type de cuisine</label>
        <input id="f-cuisine" name="cuisine" defaultValue={cuisine} className="input" placeholder="ex. burkinabè, libanaise" />
      </div>
      <div>
        <label className="label" htmlFor="f-price">Niveau de prix</label>
        <select id="f-price" name="price" defaultValue={price} className="input">
          <option value="">Tous</option>
          <option value="1">Économique</option>
          <option value="2">Moyen</option>
          <option value="3">Haut de gamme</option>
        </select>
      </div>
      <fieldset>
        <legend className="label">Mode</legend>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-lilac p-1">
          {[
            ["", "Tous"],
            ["delivery", "Livraison"],
            ["pickup", "Retrait"],
          ].map(([v, l]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="mode" value={v} defaultChecked={mode === v} className="peer sr-only" />
              <span className="block rounded-xl py-2 text-center text-xs font-semibold text-violet/70 transition peer-checked:bg-white peer-checked:text-violet peer-checked:shadow-sm">
                {l}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl bg-lilac/60 px-3 py-2.5 font-semibold text-violet">
        <input type="checkbox" name="open" value="1" defaultChecked={openNow} /> Ouvert maintenant
      </label>
      <div className="flex gap-2">
        <button className="btn-primary flex-1">Appliquer</button>
        <Link href="/restaurants" className="btn-ghost">
          Effacer
        </Link>
      </div>
    </form>
  );

  return (
    <>
      <Banner
        tone="white"
        crumbs={[{ label: "Restaurants" }]}
        title="Trouvez le restaurant"
        highlight="qui vous fait envie."
        text="Filtrez par ville, quartier, type de cuisine, prix, livraison ou retrait."
        illustration="shop"
      >
        <form className="flex w-full max-w-xl flex-col gap-2 rounded-[24px] bg-white p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-line sm:flex-row sm:items-center sm:rounded-full" role="search">
          <div className="flex flex-1 items-center gap-2 pl-4">
            <Search className="size-4 shrink-0 text-violet-300" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Restaurant, plat ou quartier" aria-label="Recherche" className="min-h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
          </div>
          <select name="city" defaultValue={city} className="min-h-11 rounded-full bg-lilac px-4 text-sm font-semibold text-violet outline-none sm:max-w-44" aria-label="Ville">
            <option value="">Toutes les villes</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="btn-primary">Filtrer</button>
        </form>
      </Banner>

      <div className="container-dg mt-8 space-y-5">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Link href={href({ open: openNow ? "" : "1" })} className={`chip shrink-0 px-4 py-2 ${openNow ? "bg-violet text-white" : "bg-white ring-1 ring-line"}`}>
            Ouvert maintenant
          </Link>
          <Link href={href({ mode: mode === "delivery" ? "" : "delivery" })} className={`chip shrink-0 px-4 py-2 ${mode === "delivery" ? "bg-violet text-white" : "bg-white ring-1 ring-line"}`}>
            Livraison
          </Link>
          <Link href={href({ mode: mode === "pickup" ? "" : "pickup" })} className={`chip shrink-0 px-4 py-2 ${mode === "pickup" ? "bg-violet text-white" : "bg-white ring-1 ring-line"}`}>
            Retrait
          </Link>
          {categories?.slice(0, 8).map((c) => (
            <Link
              key={c.slug}
              href={href({ category: category === c.slug ? "" : c.slug })}
              className={`chip shrink-0 px-4 py-2 ${category === c.slug ? "bg-violet text-white" : "bg-white ring-1 ring-line"}`}
            >
              <span aria-hidden>{c.icon}</span> {c.name}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="card sticky top-24">
              <p className="mb-4 flex items-center gap-2 font-bold text-violet">
                <SlidersHorizontal className="size-4" aria-hidden /> Filtres
              </p>
              {filters}
            </div>
          </aside>

          <div>
            <details className="card mb-4 p-0 lg:hidden">
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-bold text-violet">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4" aria-hidden /> Plus de filtres
                </span>
                {activeCount > 0 && <span className="badge bg-orange text-violet-800">{activeCount}</span>}
              </summary>
              <div className="border-t border-line px-5 py-4">{filters}</div>
            </details>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                <strong className="text-violet">{list.length}</strong> établissement{list.length > 1 ? "s" : ""}
                {q && <> pour « {q} »</>}
              </p>
              {(activeCount > 0 || q || city) && (
                <Link href="/restaurants" className="btn-ghost btn-sm">
                  <X className="size-3.5" aria-hidden /> Réinitialiser
                </Link>
              )}
            </div>
            {list.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((r, i) => (
                  <div key={r.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                    <RestaurantCard r={r} />
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Aucun restaurant ne correspond à ces critères. Essayez d&apos;élargir votre recherche.</Empty>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
