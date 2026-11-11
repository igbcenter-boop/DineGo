import type { Metadata } from "next";
import Link from "next/link";
import { requireMyRestaurant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Banner, BannerChips } from "@/components/Banner";
import { Flash, Kpi, Section, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { toggleOpen } from "@/app/actions/restaurant";
import { dateTime, fcfa } from "@/lib/format";
import { generateSettlements } from "@/lib/orders";

export const metadata: Metadata = { title: "Espace restaurant" };

export default async function RestaurantDashboard(props: PageProps<"/restaurant">) {
  const { restaurant } = await requireMyRestaurant();
  await generateSettlements(restaurant.id);
  const supabase = await createClient();
  const [{ data: orders }, { data: fin }, { data: settlements }, { data: recent }] = await Promise.all([
    supabase.from("orders").select("status, total, delivery_fee").eq("restaurant_id", restaurant.id),
    supabase.from("order_financials").select("restaurant_share, dinego_share, courier_share, collected_amount, collector, orders!inner(status)").eq("restaurant_id", restaurant.id).eq("orders.status", "completed"),
    supabase.from("settlements").select("direction, amount_due, amount_paid, status").eq("restaurant_id", restaurant.id),
    supabase.from("orders").select("id, code, status, total, created_at, payment_status").eq("restaurant_id", restaurant.id).order("created_at", { ascending: false }).limit(8),
  ]);
  const count = (st: string[]) => (orders ?? []).filter((o) => st.includes(o.status)).length;
  const done = fin ?? [];
  const sum = (k: "restaurant_share" | "dinego_share" | "courier_share" | "collected_amount") => done.reduce((a, f) => a + Number(f[k]), 0);
  const collectedByRestaurant = done.filter((f) => f.collector === "restaurant").reduce((a, f) => a + f.collected_amount, 0);
  const toDinego = (settlements ?? []).filter((x) => x.direction === "to_dinego" && x.status !== "paid").reduce((a, x) => a + x.amount_due - x.amount_paid, 0);
  const fromDinego = (settlements ?? []).filter((x) => x.direction === "to_restaurant" && x.status !== "paid").reduce((a, x) => a + x.amount_due - x.amount_paid, 0);
  const turnover = (orders ?? []).filter((o) => o.status === "completed").reduce((a, o) => a + o.total, 0);
  const deliveryFees = (orders ?? []).filter((o) => o.status === "completed").reduce((a, o) => a + o.delivery_fee, 0);

  return (
    <>
      <Banner
        tone="white"
        crumbs={[{ label: "Espace restaurant" }]}
        title="Bienvenue,"
        highlight={`${restaurant.name}.`}
        text="Commandes en attente, chiffre d'affaires, reversements à venir : toute votre activité d'un coup d'œil."
        illustration="dashboard"
      >
        <BannerChips
          items={[
            { label: "Commandes", href: "/restaurant/commandes" },
            { label: "Menu", href: "/restaurant/menu" },
            { label: "Livreurs", href: "/restaurant/livreurs" },
            { label: "Finances", href: "/restaurant/finances" },
            { label: "Reversements", href: "/restaurant/reversements" },
          ]}
        />
      </Banner>
      <div className="container-dg mt-8 space-y-8">
        <Flash searchParams={props.searchParams} />
        {restaurant.status !== "active" && (
          <p className="rounded-xl bg-peach px-4 py-3 text-sm font-semibold text-orange-700">
            Statut : {restaurant.status === "pending" ? "en attente de validation par DineGo" : restaurant.status === "suspended" ? "suspendu" : "refusé"}. Votre page n&apos;est pas visible des clients
            {restaurant.status === "pending" ? " — préparez votre menu en attendant." : "."}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <form action={toggleOpen}>
            <SubmitButton className={restaurant.is_open ? "btn-outline" : "btn-primary"}>{restaurant.is_open ? "Fermer temporairement" : "Ouvrir aux commandes"}</SubmitButton>
          </form>
          <span className="text-sm text-muted">Actuellement : <strong>{restaurant.is_open ? "ouvert" : "fermé"}</strong></span>
          <Link href={`/restaurants/${restaurant.slug}`} className="btn-ghost btn-sm">Voir ma page publique →</Link>
        </div>

        <Section title="Commandes">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Reçues (total)" value={(orders ?? []).length} />
            <Kpi label="En attente" value={count(["sent", "received"])} tone="orange" />
            <Kpi label="Acceptées" value={count(["accepted"])} />
            <Kpi label="En préparation" value={count(["preparing", "ready", "awaiting_pickup", "delivering"])} />
            <Kpi label="Terminées" value={count(["completed"])} tone="green" />
          </div>
        </Section>

        <Section title="Finances" action={<Link href="/restaurant/finances" className="btn-ghost btn-sm">Détail →</Link>}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Chiffre d'affaires" value={fcfa(turnover)} hint="Commandes terminées" />
            <Kpi label="Revenus du restaurant" value={fcfa(sum("restaurant_share"))} tone="green" />
            <Kpi label="Commissions DineGo" value={fcfa(sum("dinego_share"))} />
            <Kpi label="Frais de livraison" value={fcfa(deliveryFees)} />
            <Kpi label="Encaissé par le restaurant" value={fcfa(collectedByRestaurant)} />
            <Kpi label="À reverser à DineGo" value={fcfa(toDinego)} tone={toDinego ? "orange" : "violet"} />
            <Kpi label="À recevoir de DineGo" value={fcfa(fromDinego)} />
            <Kpi label="Rémunérations livreurs" value={fcfa(sum("courier_share"))} />
          </div>
        </Section>

        <Section title="Dernières transactions">
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead>
                <tr><th>Commande</th><th>Date</th><th>Montant</th><th>Statut</th><th>Paiement</th></tr>
              </thead>
              <tbody>
                {recent?.map((o) => (
                  <tr key={o.id}>
                    <td className="font-bold">{o.code}</td>
                    <td>{dateTime(o.created_at)}</td>
                    <td>{fcfa(o.total)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><StatusBadge status={o.payment_status} label={o.payment_status === "confirmed" ? "Payée" : o.payment_status === "pending" ? "En attente" : o.payment_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}
