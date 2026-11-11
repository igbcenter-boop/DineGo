import type { Metadata } from "next";
import { requireMyRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { deletePromotion, savePromotion, togglePromotion } from "@/app/actions/restaurant";
import { dateOnly, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Promotions" };

export default async function RestaurantPromotions(props: PageProps<"/restaurant/promotions">) {
  const { restaurant } = await requireMyRestaurant();
  const db = createAdminClient();
  const [{ data: promos }, { data: products }] = await Promise.all([
    db.from("promotions").select("*, products(name)").eq("restaurant_id", restaurant.id).order("created_at", { ascending: false }),
    db.from("products").select("id, name").eq("restaurant_id", restaurant.id).order("name"),
  ]);
  return (
    <div className="container-dg mt-8 space-y-6">
      <h1 className="h1">Promotions</h1>
      <Flash searchParams={props.searchParams} />
      <form action={savePromotion} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <p className="h3 sm:col-span-2 lg:col-span-3">Nouvelle promotion</p>
        <div>
          <label className="label" htmlFor="title">Titre *</label>
          <input id="title" name="title" required placeholder="Menu du midi à -15 %" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="discount_percent">Réduction (%) *</label>
          <input id="discount_percent" name="discount_percent" type="number" min={1} max={90} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="product_id">Produit concerné</label>
          <select id="product_id" name="product_id" className="input">
            <option value="">Toute la commande</option>
            {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="min_order">Montant minimum (FCFA)</label>
          <input id="min_order" name="min_order" type="number" min={0} defaultValue={0} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="starts_at">Début</label>
          <input id="starts_at" name="starts_at" type="datetime-local" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ends_at">Fin (offre temporaire)</label>
          <input id="ends_at" name="ends_at" type="datetime-local" className="input" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="conditions">Conditions de l&apos;offre *</label>
          <input id="conditions" name="conditions" required placeholder="Valable du lundi au vendredi, hors boissons" className="input" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="description">Description</label>
          <input id="description" name="description" className="input" />
        </div>
        <SubmitButton className="btn-primary w-fit">Publier</SubmitButton>
      </form>
      {promos?.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {promos.map((p) => (
            <li key={p.id} className={`card space-y-1 ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between">
                <span className="badge bg-orange text-violet-700">-{p.discount_percent}%</span>
                <span className="text-xs text-muted">{dateOnly(p.starts_at)} → {p.ends_at ? dateOnly(p.ends_at) : "sans fin"}</span>
              </div>
              <p className="font-bold text-violet">{p.title}</p>
              <p className="text-xs text-muted">
                {(p.products as unknown as { name: string } | null)?.name ?? "Toute la commande"}
                {p.min_order > 0 ? ` · dès ${fcfa(p.min_order)}` : ""} · {p.conditions}
              </p>
              <div className="flex gap-2 pt-2">
                <form action={togglePromotion}>
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton className="btn-outline btn-sm">{p.active ? "Désactiver" : "Activer"}</SubmitButton>
                </form>
                <form action={deletePromotion}>
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton className="btn-ghost btn-sm" confirm="Supprimer cette promotion ?">Supprimer</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Aucune promotion pour le moment.</Empty>
      )}
    </div>
  );
}
