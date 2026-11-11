import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/Banner";
import { Empty, Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { requestReservation } from "@/app/actions/client";

export const metadata: Metadata = { title: "Réserver une table" };

export default async function ReservationPage(props: PageProps<"/reservation">) {
  const sp = await props.searchParams;
  const preselect = typeof sp.restaurant === "string" ? sp.restaurant : "";
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name, slug, city")
    .eq("status", "active")
    .eq("accepts_reservations", true)
    .order("name");
  return (
    <>
      <Banner
        tone="violet"
        crumbs={[{ label: "Réserver une table" }]}
        title="Réservez votre table"
        highlight="en quelques clics."
        text="Choisissez le restaurant, la date, l'heure et le nombre de personnes. Confirmation par notification."
        illustration="calendar"
      >
        <a href="#form" className="btn-primary">Réserver une table</a>
      </Banner>
      <div id="form" className="container-dg mt-8 max-w-xl scroll-mt-20">
        <Flash searchParams={props.searchParams} />
        {!restaurants?.length ? (
          <Empty>Aucun restaurant ne propose encore la réservation en ligne.</Empty>
        ) : profile?.role === "client" ? (
          <form action={requestReservation} className="card grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="restaurant_id">Restaurant</label>
              <select id="restaurant_id" name="restaurant_id" defaultValue={restaurants.find((r) => r.slug === preselect)?.id} className="input">
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.city})</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="reserved_for">Date et heure</label>
              <input id="reserved_for" name="reserved_for" type="datetime-local" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="people">Nombre de personnes</label>
              <input id="people" name="people" type="number" min={1} max={50} defaultValue={2} required className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="note">Remarque</label>
              <input id="note" name="note" className="input" placeholder="Anniversaire, terrasse…" />
            </div>
            <SubmitButton className="btn-primary sm:col-span-2">Envoyer la demande</SubmitButton>
          </form>
        ) : (
          <div className="card space-y-3 text-sm">
            <p>Connectez-vous avec un compte client pour réserver une table.</p>
            <a href="/connexion?next=/reservation" className="btn-primary">Se connecter</a>
          </div>
        )}
      </div>
    </>
  );
}
