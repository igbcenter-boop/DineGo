import type { Metadata } from "next";
import { requireMyRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { updateFinancialSettings, updateRestaurant } from "@/app/actions/restaurant";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Paramètres du restaurant" };

const FIELD_LABEL: Record<string, string> = { collection_mode: "Mode d'encaissement", remittance_frequency: "Fréquence de reversement" };
const VALUE_LABEL: Record<string, string> = { dinego: "DineGo", restaurant: "Restaurant", daily: "Quotidien", weekly: "Hebdomadaire" };

export default async function RestaurantSettings(props: PageProps<"/restaurant/parametres">) {
  const { restaurant: r } = await requireMyRestaurant();
  const db = createAdminClient();
  const [{ data: categories }, { data: zones }, { data: history }] = await Promise.all([
    db.from("categories").select("id, name").order("sort"),
    db.from("zones").select("id, city, name").order("city").order("name"),
    db.from("restaurant_setting_changes").select("*").eq("restaurant_id", r.id).order("changed_at", { ascending: false }),
  ]);
  const t = (k: string) => (r[k] ?? "") as string;

  return (
    <div className="container-dg mt-8 space-y-8">
      <h1 className="h1">Paramètres</h1>
      <Flash searchParams={props.searchParams} />

      <form action={updateRestaurant} className="card grid gap-4 sm:grid-cols-2">
        <p className="h2 sm:col-span-2">Présentation de l&apos;établissement</p>
        <Field label="Nom commercial" name="name" value={t("name")} />
        <Field label="Nom du responsable" name="manager_name" value={t("manager_name")} />
        <Field label="Téléphone" name="phone" value={t("phone")} />
        <Field label="Ville" name="city" value={t("city")} />
        <Field label="Adresse" name="address" value={t("address")} wide />
        <div>
          <label className="label" htmlFor="category_id">Catégorie</label>
          <select id="category_id" name="category_id" defaultValue={t("category_id")} className="input">
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="zone_id">Zone</label>
          <select id="zone_id" name="zone_id" defaultValue={t("zone_id")} className="input">
            <option value="">—</option>
            {zones?.map((z) => <option key={z.id} value={z.id}>{z.name} ({z.city})</option>)}
          </select>
        </div>
        <Field label="Type de cuisine" name="cuisine_type" value={t("cuisine_type")} />
        <div>
          <label className="label" htmlFor="price_level">Niveau de prix</label>
          <select id="price_level" name="price_level" defaultValue={String(r.price_level)} className="input">
            <option value="1">Économique</option>
            <option value="2">Moyen</option>
            <option value="3">Haut de gamme</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Présentation</label>
          <textarea id="description" name="description" rows={4} defaultValue={t("description")} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ouverture" name="opens_at" value={t("opens_at").slice(0, 5)} type="time" />
          <Field label="Fermeture" name="closes_at" value={t("closes_at").slice(0, 5)} type="time" />
        </div>
        <Field label="Horaires détaillés" name="opening_hours" value={t("opening_hours")} />
        <Field label="Zones de livraison" name="delivery_zones" value={t("delivery_zones")} />
        <Field label="Conditions de livraison" name="delivery_conditions" value={t("delivery_conditions")} />
        <div>
          <label className="label" htmlFor="logo">Logo {r.logo_url && "(remplacer)"}</label>
          <input id="logo" name="logo" type="file" accept="image/*" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="cover">Photo de couverture {r.cover_url && "(remplacer)"}</label>
          <input id="cover" name="cover" type="file" accept="image/*" className="input" />
        </div>
        <Field label="Informations financières (n° marchand, IFU…)" name="financial_info" value={t("financial_info")} wide />
        <fieldset className="flex flex-wrap gap-4 text-sm sm:col-span-2">
          <legend className="label">Services</legend>
          <label className="flex items-center gap-2"><input type="checkbox" name="offers_delivery" defaultChecked={r.offers_delivery} /> Livraison</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="offers_pickup" defaultChecked={r.offers_pickup} /> Retrait sur place</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="accepts_scheduled" defaultChecked={r.accepts_scheduled} /> Commandes programmées</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="accepts_reservations" defaultChecked={r.accepts_reservations} /> Réservation de table</label>
        </fieldset>
        <SubmitButton className="btn-primary w-fit">Enregistrer</SubmitButton>
      </form>

      <form id="finances" action={updateFinancialSettings} className="card scroll-mt-20 space-y-4">
        <p className="h2">Encaissement et reversements</p>
        <fieldset className="grid gap-3 md:grid-cols-2">
          <legend className="label">Qui encaisse le montant payé par le client ?</legend>
          <label className="flex gap-3 rounded-xl border-2 border-line p-3 text-sm has-[:checked]:border-orange has-[:checked]:bg-cream">
            <input type="radio" name="collection_mode" value="dinego" defaultChecked={r.collection_mode === "dinego"} />
            <span>
              <strong className="text-violet">Option A — DineGo encaisse</strong>
              <br />DineGo reçoit le paiement, calcule les parts et vous reverse la vôtre.
            </span>
          </label>
          <label className="flex gap-3 rounded-xl border-2 border-line p-3 text-sm has-[:checked]:border-orange has-[:checked]:bg-cream">
            <input type="radio" name="collection_mode" value="restaurant" defaultChecked={r.collection_mode === "restaurant"} />
            <span>
              <strong className="text-violet">Option B — Le restaurant encaisse</strong>
              <br />Vous recevez le paiement, conservez votre part et reversez à DineGo les sommes dues.
            </span>
          </label>
        </fieldset>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="label">Fréquence de reversement (option B)</legend>
          <label className="flex items-center gap-2"><input type="radio" name="remittance_frequency" value="daily" defaultChecked={r.remittance_frequency === "daily"} /> Quotidienne</label>
          <label className="flex items-center gap-2"><input type="radio" name="remittance_frequency" value="weekly" defaultChecked={r.remittance_frequency === "weekly"} /> Hebdomadaire</label>
        </fieldset>
        <p className="text-xs text-muted">Les changements s&apos;appliquent aux nouvelles commandes et aux nouvelles échéances. Les commandes confirmées et les échéances déjà constituées ne sont pas modifiées.</p>
        <SubmitButton className="btn-primary">Enregistrer</SubmitButton>
        {!!history?.length && (
          <div>
            <p className="h3 mb-1">Historique des modifications</p>
            <ul className="text-xs text-muted">
              {history.map((h) => (
                <li key={h.id}>
                  {dateTime(h.changed_at)} — {FIELD_LABEL[h.field] ?? h.field} : {VALUE_LABEL[h.old_value] ?? h.old_value} → {VALUE_LABEL[h.new_value] ?? h.new_value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}

function Field({ label, name, value, type = "text", wide }: { label: string; name: string; value: string; type?: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value} className="input" />
    </div>
  );
}
