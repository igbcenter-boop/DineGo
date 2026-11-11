import type { Metadata } from "next";
import { requireMyRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { addCourier, payCourierEarning, toggleMyCourier } from "@/app/actions/restaurant";
import { MISSION_STATUS, dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Livreurs" };

export default async function RestaurantCouriers(props: PageProps<"/restaurant/livreurs">) {
  const { restaurant } = await requireMyRestaurant();
  const db = createAdminClient();
  const [{ data: couriers }, { data: zones }] = await Promise.all([
    db.from("couriers").select("*, zones(name)").eq("restaurant_id", restaurant.id).order("created_at"),
    db.from("zones").select("id, city, name").order("city").order("name"),
  ]);
  const ids = (couriers ?? []).map((c) => c.id);
  const [{ data: missions }, { data: earnings }] = await Promise.all([
    ids.length ? db.from("delivery_missions").select("*, orders(code)").in("courier_id", ids).order("created_at", { ascending: false }).limit(50) : { data: [] },
    db.from("courier_earnings").select("*, couriers(full_name), orders!inner(code, restaurant_id)").eq("orders.restaurant_id", restaurant.id).eq("paid_by", "restaurant").order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <div className="container-dg mt-8 space-y-8">
      <h1 className="h1">Mes livreurs</h1>
      <Flash searchParams={props.searchParams} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-2">
          {couriers?.length ? (
            couriers.map((c) => {
              const done = (missions ?? []).filter((m) => m.courier_id === c.id && m.status === "delivered").length;
              return (
                <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-violet">{c.full_name}</p>
                    <p className="text-xs text-muted">
                      {c.phone} · {(c.zones as unknown as { name: string } | null)?.name ?? "—"} · {c.vehicle ?? "—"} · {c.user_id ? "accès espace livreur" : "géré par le restaurant"} · {done} livraison(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} label={c.status === "active" ? "Actif" : "Suspendu"} />
                    <form action={toggleMyCourier}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton className="btn-outline btn-sm">{c.status === "active" ? "Suspendre" : "Réactiver"}</SubmitButton>
                    </form>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty>Aucun livreur propre. Vous pouvez aussi solliciter le réseau DineGo depuis une commande.</Empty>
          )}
        </div>
        <form action={addCourier} className="card space-y-3">
          <p className="h3">Ajouter un livreur</p>
          <input name="full_name" required placeholder="Nom et prénom" aria-label="Nom" className="input" />
          <input name="phone" required placeholder="Téléphone" aria-label="Téléphone" className="input" />
          <select name="zone_id" aria-label="Zone" className="input" defaultValue={restaurant.zone_id ?? ""}>
            <option value="">Zone du restaurant</option>
            {zones?.map((z) => <option key={z.id} value={z.id}>{z.name} ({z.city})</option>)}
          </select>
          <input name="vehicle" placeholder="Véhicule" aria-label="Véhicule" className="input" />
          <fieldset className="space-y-2 rounded-xl bg-lilac/50 p-3">
            <legend className="text-xs font-bold text-violet">Accès à l&apos;espace livreur (facultatif)</legend>
            <input name="email" type="email" placeholder="E-mail du livreur" aria-label="E-mail" className="input" />
            <input name="password" type="password" minLength={8} placeholder="Mot de passe provisoire" aria-label="Mot de passe" className="input" />
            <p className="text-xs text-muted">Sans accès, c&apos;est vous qui mettez à jour les étapes de livraison et confirmez les encaissements.</p>
          </fieldset>
          <SubmitButton>Ajouter</SubmitButton>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="h2">Missions récentes</h2>
        {missions?.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead><tr><th>Date</th><th>Commande</th><th>Livreur</th><th>Statut</th></tr></thead>
              <tbody>
                {missions.map((m) => (
                  <tr key={m.id}>
                    <td>{dateTime(m.created_at)}</td>
                    <td>{(m.orders as unknown as { code: string })?.code}</td>
                    <td>{couriers?.find((c) => c.id === m.courier_id)?.full_name}</td>
                    <td>{MISSION_STATUS[m.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucune mission.</Empty>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="h2">Rémunérations à régler par le restaurant</h2>
        {earnings?.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead><tr><th>Date</th><th>Commande</th><th>Livreur</th><th>Montant</th><th>Statut</th><th /></tr></thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id}>
                    <td>{dateTime(e.created_at)}</td>
                    <td>{(e.orders as unknown as { code: string })?.code}</td>
                    <td>{(e.couriers as unknown as { full_name: string })?.full_name}</td>
                    <td>{fcfa(e.amount)}</td>
                    <td><StatusBadge status={e.status} label={e.status === "paid" ? "Réglée" : "À régler"} /></td>
                    <td>
                      {e.status === "due" && (
                        <form action={payCourierEarning}>
                          <input type="hidden" name="id" value={e.id} />
                          <SubmitButton className="btn-primary btn-sm">Marquer réglée</SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucune rémunération à régler.</Empty>
        )}
      </section>
    </div>
  );
}
