import type { Metadata } from "next";
import { requireMyRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { addMenuCategory, deleteMenuCategory, deleteProduct, saveProduct, toggleProduct } from "@/app/actions/restaurant";
import { fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Menu" };

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  available: boolean;
  is_combo: boolean;
  options: { name: string; price: number }[];
  menu_category_id: string | null;
};

const SUGGESTED = ["Entrées", "Plats principaux", "Grillades", "Accompagnements", "Desserts", "Boissons", "Menus spéciaux"];

function ProductForm({ p, sections }: { p?: Product; sections: { id: string; name: string }[] }) {
  return (
    <form action={saveProduct} className="grid gap-3 sm:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div>
        <label className="label" htmlFor={`n-${p?.id ?? "new"}`}>Nom *</label>
        <input id={`n-${p?.id ?? "new"}`} name="name" defaultValue={p?.name} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`pr-${p?.id ?? "new"}`}>Prix (FCFA) *</label>
        <input id={`pr-${p?.id ?? "new"}`} name="price" type="number" min={0} step={25} defaultValue={p?.price} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`c-${p?.id ?? "new"}`}>Rubrique</label>
        <select id={`c-${p?.id ?? "new"}`} name="menu_category_id" defaultValue={p?.menu_category_id ?? ""} className="input">
          <option value="">— Aucune —</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`ph-${p?.id ?? "new"}`}>Photo</label>
        <input id={`ph-${p?.id ?? "new"}`} name="photo" type="file" accept="image/*" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`d-${p?.id ?? "new"}`}>Description</label>
        <textarea id={`d-${p?.id ?? "new"}`} name="description" rows={2} defaultValue={p?.description ?? ""} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`o-${p?.id ?? "new"}`}>Variantes / suppléments (une par ligne : « Nom : prix »)</label>
        <textarea
          id={`o-${p?.id ?? "new"}`}
          name="options"
          rows={2}
          defaultValue={(p?.options ?? []).map((o) => `${o.name} : ${o.price}`).join("\n")}
          placeholder={"Frites : 500\nSauce piment : 0"}
          className="input"
        />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="available" defaultChecked={p?.available ?? true} /> Disponible</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_combo" defaultChecked={p?.is_combo ?? false} /> Menu composé</label>
      <SubmitButton className="btn-primary sm:col-span-2 sm:w-fit">{p ? "Enregistrer" : "Ajouter le plat"}</SubmitButton>
    </form>
  );
}

export default async function MenuPage(props: PageProps<"/restaurant/menu">) {
  const { restaurant } = await requireMyRestaurant();
  const db = createAdminClient();
  const [{ data: sections }, { data: products }] = await Promise.all([
    db.from("menu_categories").select("id, name, sort").eq("restaurant_id", restaurant.id).order("sort"),
    db.from("products").select("*").eq("restaurant_id", restaurant.id).order("name"),
  ]);
  const list = (products ?? []) as Product[];
  const groups = [...(sections ?? []), { id: null as string | null, name: "Sans rubrique", sort: 999 }];

  return (
    <div className="container-dg mt-8 space-y-8">
      <h1 className="h1">Menu</h1>
      <Flash searchParams={props.searchParams} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <details className="card" open={!list.length}>
          <summary className="h3 cursor-pointer">+ Ajouter un plat ou une boisson</summary>
          <div className="mt-4">
            <ProductForm sections={sections ?? []} />
          </div>
        </details>
        <div className="card space-y-3">
          <p className="h3">Rubriques du menu</p>
          <ul className="space-y-1 text-sm">
            {sections?.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                {s.name}
                <form action={deleteMenuCategory}>
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton className="btn-ghost btn-sm" confirm="Supprimer cette rubrique ?">✕</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
          <form action={addMenuCategory} className="flex gap-2">
            <input name="name" list="suggested" placeholder="Nouvelle rubrique" aria-label="Nouvelle rubrique" className="input" />
            <datalist id="suggested">{SUGGESTED.map((s) => <option key={s} value={s} />)}</datalist>
            <input type="hidden" name="sort" value={(sections?.length ?? 0) + 1} />
            <SubmitButton className="btn-violet btn-sm">Ajouter</SubmitButton>
          </form>
        </div>
      </div>

      {!list.length && <Empty>Votre menu est vide. Ajoutez vos premiers plats.</Empty>}
      {groups.map((g) => {
        const items = list.filter((p) => p.menu_category_id === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id ?? "none"} className="space-y-3">
            <h2 className="h2">{g.name}</h2>
            <ul className="space-y-2">
              {items.map((p) => (
                <li key={p.id} className="card">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-lilac text-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : "🍽️"}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-violet">
                        {p.name} {p.is_combo && <span className="chip ml-1">Menu</span>} {!p.available && <span className="badge bg-red-50 text-red-800">Indisponible</span>}
                      </p>
                      <p className="text-xs text-muted">{p.description}</p>
                    </div>
                    <span className="price">{fcfa(p.price)}</span>
                    <form action={toggleProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <SubmitButton className="btn-outline btn-sm">{p.available ? "Rendre indisponible" : "Rendre disponible"}</SubmitButton>
                    </form>
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <SubmitButton className="btn-ghost btn-sm" confirm={`Supprimer « ${p.name} » ?`}>Supprimer</SubmitButton>
                    </form>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-violet">Modifier</summary>
                    <div className="mt-3">
                      <ProductForm p={p} sections={sections ?? []} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
