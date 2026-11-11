import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/Banner";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { registerCourier } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Devenir livreur" };

export default async function CourierSignupPage(props: PageProps<"/devenir-livreur">) {
  const supabase = await createClient();
  const { data: zones } = await supabase.from("zones").select("id, city, name").order("city").order("name");
  return (
    <>
      <Banner
        tone="violet"
        crumbs={[{ label: "Devenir livreur" }]}
        title="Livrez avec DineGo,"
        highlight="à votre rythme."
        text="Rejoignez le réseau central de livreurs DineGo dans votre zone et suivez vos rémunérations en ligne."
        illustration="scooter"
      >
        <a href="#inscription" className="btn-primary">
          Je deviens livreur
        </a>
      </Banner>
      <div id="inscription" className="container-dg mt-10 max-w-2xl scroll-mt-20">
        <Flash searchParams={props.searchParams} />
        <form action={registerCourier} className="card grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="full_name">Nom et prénom *</label>
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
          <div>
            <label className="label" htmlFor="zone_id">Zone d&apos;activité *</label>
            <select id="zone_id" name="zone_id" required className="input">
              {zones?.map((z) => (
                <option key={z.id} value={z.id}>{z.name} ({z.city})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="vehicle">Véhicule</label>
            <input id="vehicle" name="vehicle" placeholder="Moto, vélo…" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="id_document">N° de pièce d&apos;identité</label>
            <input id="id_document" name="id_document" className="input" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton className="btn-primary w-full">Envoyer ma candidature</SubmitButton>
            <p className="mt-2 text-xs text-muted">Votre profil sera activé après validation par l&apos;administration DineGo.</p>
          </div>
        </form>
      </div>
    </>
  );
}
