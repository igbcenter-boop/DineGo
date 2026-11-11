import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/Banner";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { registerRestaurant } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Devenir restaurant partenaire" };

export default async function PartnerPage(props: PageProps<"/devenir-partenaire">) {
  const supabase = await createClient();
  const [{ data: categories }, { data: zones }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort"),
    supabase.from("zones").select("id, city, name").order("city").order("name"),
  ]);
  const cities = [...new Set((zones ?? []).map((z) => z.city))];
  return (
    <>
      <Banner
        tone="violet"
        crumbs={[{ label: "Devenir partenaire" }]}
        title="Votre restaurant,"
        highlight="visible dans tout le Burkina."
        text="Publiez votre menu, recevez des commandes et développez votre clientèle. Sans abonnement obligatoire."
        illustration="growth"
      >
        <a href="#inscription" className="btn-primary">
          Inscrire mon restaurant
        </a>
        <a href="#fonctionnement" className="btn-outline-light">
          Comment ça marche ?
        </a>
      </Banner>

      <div className="container-dg mt-10 space-y-10">
        <section id="fonctionnement" className="grid scroll-mt-20 gap-4 md:grid-cols-4">
          {[
            ["Inscription", "Renseignez votre établissement. DineGo vérifie les informations et valide votre mise en ligne."],
            ["Menu", "Ajoutez vos plats, prix, photos, variantes et promotions depuis votre espace."],
            ["Commandes", "Recevez les commandes, acceptez-les, préparez-les et organisez la livraison ou le retrait."],
            ["Revenus", "Choisissez qui encaisse (DineGo ou vous) et suivez vos revenus, commissions et reversements."],
          ].map(([t, d], i) => (
            <div key={t} className="card">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-orange font-extrabold text-violet-700">{i + 1}</span>
              <p className="h3 mt-2">{t}</p>
              <p className="text-sm text-muted">{d}</p>
            </div>
          ))}
        </section>

        <section id="inscription" className="mx-auto max-w-3xl scroll-mt-20">
          <h2 className="h2 mb-4">Inscrire mon établissement</h2>
          <Flash searchParams={props.searchParams} />
          <form action={registerRestaurant} className="card grid gap-4 sm:grid-cols-2">
            <fieldset className="contents">
              <legend className="h3 sm:col-span-2">Responsable et accès</legend>
              <div>
                <label className="label" htmlFor="full_name">Nom du responsable *</label>
                <input id="full_name" name="full_name" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="phone">Téléphone *</label>
                <input id="phone" name="phone" type="tel" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="email">E-mail *</label>
                <input id="email" name="email" type="email" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="password">Mot de passe *</label>
                <input id="password" name="password" type="password" minLength={8} required className="input" />
              </div>
            </fieldset>
            <fieldset className="contents">
              <legend className="h3 mt-2 sm:col-span-2">Établissement</legend>
              <div>
                <label className="label" htmlFor="name">Nom commercial *</label>
                <input id="name" name="name" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="category_id">Catégorie</label>
                <select id="category_id" name="category_id" className="input">
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="city">Ville *</label>
                <input id="city" name="city" list="cities" required className="input" />
                <datalist id="cities">
                  {cities.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label" htmlFor="zone_id">Zone d&apos;activité</label>
                <select id="zone_id" name="zone_id" className="input">
                  <option value="">—</option>
                  {zones?.map((z) => (
                    <option key={z.id} value={z.id}>{z.name} ({z.city})</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="address">Adresse *</label>
                <input id="address" name="address" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="cuisine_type">Type de cuisine</label>
                <input id="cuisine_type" name="cuisine_type" placeholder="ex. burkinabè, grillades" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="opens_at">Ouverture</label>
                  <input id="opens_at" name="opens_at" type="time" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="closes_at">Fermeture</label>
                  <input id="closes_at" name="closes_at" type="time" className="input" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="opening_hours">Horaires détaillés</label>
                <input id="opening_hours" name="opening_hours" placeholder="Lun–Sam 10h–23h, Dim 12h–22h" className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="description">Description</label>
                <textarea id="description" name="description" rows={3} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="logo">Logo ou photo</label>
                <input id="logo" name="logo" type="file" accept="image/*" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="financial_info">Informations financières</label>
                <input id="financial_info" name="financial_info" placeholder="N° Orange Money / IFU / compte" className="input" />
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <SubmitButton className="btn-primary w-full">Envoyer mon inscription</SubmitButton>
              <p className="mt-2 text-xs text-muted">Votre établissement sera mis en ligne après vérification par l&apos;équipe DineGo.</p>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
