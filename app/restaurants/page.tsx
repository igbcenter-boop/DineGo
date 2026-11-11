import type { Metadata } from "next";
import Link from "next/link";
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
    supabase.from("categories").select("id, name, slug").order("sort"),
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
        <form className="flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-line bg-white p-2 sm:flex-row" role="search">
          <input name="q" defaultValue={q} placeholder="Restaurant, plat ou quartier" className="input border-0" aria-label="Recherche" />
          <select name="city" defaultValue={city} className="input border-0 sm:max-w-44" aria-label="Ville">
            <option value="">Toutes les villes</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="btn-primary">Filtrer</button>
        </form>
      </Banner>

      <div className="container-dg mt-8 grid gap-6 lg:grid-cols-[250px_1fr]">
        <form className="card h-fit space-y-3 text-sm" aria-label="Filtres">
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
            {[
              ["", "Indifférent"],
              ["delivery", "Livraison"],
              ["pickup", "Retrait sur place"],
            ].map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 py-0.5">
                <input type="radio" name="mode" value={v} defaultChecked={mode === v} /> {l}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="open" value="1" defaultChecked={openNow} /> Ouvert maintenant
          </label>
          <div className="flex gap-2">
            <button className="btn-primary flex-1">Appliquer</button>
            <Link href="/restaurants" className="btn-ghost">
              Effacer
            </Link>
          </div>
        </form>

        <div>
          <p className="mb-3 text-sm text-muted">
            {list.length} établissement{list.length > 1 ? "s" : ""}
            {q && <> pour « {q} »</>}
          </p>
          {list.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((r) => (
                <RestaurantCard key={r.id} r={r} />
              ))}
            </div>
          ) : (
            <Empty>Aucun restaurant ne correspond à ces critères. Essayez d&apos;élargir votre recherche.</Empty>
          )}
        </div>
      </div>
    </>
  );
}
