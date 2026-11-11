import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Banner, BannerChips } from "@/components/Banner";
import { Empty, Flash, Section, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ReorderButton } from "@/components/CartWidgets";
import { addAddress, deleteAddress, updateMyProfile } from "@/app/actions/client";
import { dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Mon compte" };

const RES_LABEL: Record<string, string> = { requested: "En attente", confirmed: "Confirmée", declined: "Refusée", cancelled: "Annulée" };

export default async function AccountPage(props: PageProps<"/compte">) {
  const profile = await requireRole("client", "/compte");
  const supabase = await createClient();
  const [{ data: orders }, { data: addresses }, { data: reviews }, { data: reservations }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, code, status, total, mode, created_at, restaurants(id, name, slug), order_items(product_id, name, unit_price, quantity, options)")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("addresses").select("*").order("created_at"),
    supabase.from("reviews").select("*, restaurants(name, slug)").eq("client_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("reservations").select("*, restaurants(name)").eq("client_id", profile.id).order("reserved_for", { ascending: false }),
  ]);
  const firstName = profile.full_name.split(" ")[0] || "et bienvenue";

  return (
    <>
      <Banner
        tone="violet"
        crumbs={[{ label: "Mon compte" }]}
        title={`Bonjour ${firstName},`}
        highlight="bon appétit !"
        text="Vos adresses, vos commandes, vos avis et vos notifications au même endroit."
        illustration="user"
      >
        <BannerChips
          dark
          items={[
            { label: "Mes commandes", href: "#commandes" },
            { label: "Mes adresses", href: "#adresses" },
            { label: "Mes avis", href: "#avis" },
            { label: "Notifications", href: "/notifications" },
          ]}
        />
      </Banner>

      <div className="container-dg mt-8 space-y-12">
        <Flash searchParams={props.searchParams} />

        <div id="commandes" className="scroll-mt-20">
          <Section title="Mes commandes">
            {orders?.length ? (
              <ul className="space-y-3">
                {orders.map((o) => {
                  const resto = o.restaurants as unknown as { id: string; name: string; slug: string } | null;
                  const items = (o.order_items ?? []) as { product_id: string | null; name: string; unit_price: number; quantity: number; options: { name: string; price: number }[] }[];
                  return (
                    <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-extrabold text-violet">
                          {o.code} · {resto?.name}
                        </p>
                        <p className="text-xs text-muted">
                          {dateTime(o.created_at)} · {o.mode === "delivery" ? "Livraison" : "Retrait"} · {fcfa(o.total)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={o.status} />
                        <Link href={`/compte/commandes/${o.id}`} className="btn-violet btn-sm">
                          Suivre / détails
                        </Link>
                        {resto && (
                          <ReorderButton
                            restaurant={resto}
                            items={items
                              .filter((i) => i.product_id)
                              .map((i) => ({ product_id: i.product_id as string, name: i.name, unit_price: i.unit_price, quantity: i.quantity, options: i.options ?? [] }))}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>
                Aucune commande pour l&apos;instant. <Link href="/restaurants" className="font-bold text-violet underline">Découvrir les restaurants</Link>
              </Empty>
            )}
          </Section>
        </div>

        <div id="adresses" className="grid scroll-mt-20 gap-6 lg:grid-cols-2">
          <Section title="Mes adresses">
            {addresses?.length ? (
              <ul className="space-y-2">
                {addresses.map((a) => (
                  <li key={a.id} className="card flex items-start justify-between gap-2 text-sm">
                    <span>
                      <strong className="text-violet">{a.label}</strong>
                      <br />
                      {a.details}, {a.zone ? `${a.zone}, ` : ""}
                      {a.city}
                    </span>
                    <form action={deleteAddress}>
                      <input type="hidden" name="id" value={a.id} />
                      <SubmitButton className="btn-ghost btn-sm" confirm="Supprimer cette adresse ?">Supprimer</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune adresse enregistrée.</Empty>
            )}
            <form action={addAddress} className="card grid gap-3 sm:grid-cols-2">
              <p className="h3 sm:col-span-2">Ajouter une adresse</p>
              <input name="label" placeholder="Libellé (Maison, Bureau…)" aria-label="Libellé" className="input" />
              <input name="city" placeholder="Ville" aria-label="Ville" defaultValue="Ouagadougou" required className="input" />
              <input name="zone" placeholder="Quartier" aria-label="Quartier" className="input" />
              <input name="phone" placeholder="Téléphone (facultatif)" aria-label="Téléphone" className="input" />
              <input name="details" placeholder="Adresse précise / repères" aria-label="Adresse précise" required className="input sm:col-span-2" />
              <SubmitButton className="btn-primary sm:col-span-2">Enregistrer</SubmitButton>
            </form>
          </Section>
          <Section title="Mes coordonnées">
            <form action={updateMyProfile} className="card space-y-3">
              <input type="hidden" name="back" value="/compte" />
              <div>
                <label className="label" htmlFor="full_name">Nom</label>
                <input id="full_name" name="full_name" defaultValue={profile.full_name} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="phone">Téléphone</label>
                <input id="phone" name="phone" defaultValue={profile.phone ?? ""} className="input" />
              </div>
              <p className="text-xs text-muted">E-mail : {profile.email}</p>
              <SubmitButton className="btn-primary">Mettre à jour</SubmitButton>
            </form>
          </Section>
        </div>

        <div id="avis" className="scroll-mt-20">
          <Section title="Mes avis">
            {reviews?.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {reviews.map((v) => (
                  <li key={v.id} className="card text-sm">
                    <p className="font-bold text-violet">{(v.restaurants as unknown as { name: string } | null)?.name}</p>
                    <p className="text-orange">{"★".repeat(v.rating_restaurant)}</p>
                    {v.comment && <p>{v.comment}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Vous pourrez noter les restaurants après vos commandes terminées.</Empty>
            )}
          </Section>
        </div>

        <div id="reservations" className="scroll-mt-20">
          <Section title="Mes réservations" action={<Link href="/reservation" className="btn-ghost btn-sm">Réserver une table →</Link>}>
            {reservations?.length ? (
              <ul className="space-y-2">
                {reservations.map((r) => (
                  <li key={r.id} className="card flex flex-wrap justify-between gap-2 text-sm">
                    <span>
                      <strong className="text-violet">{(r.restaurants as unknown as { name: string } | null)?.name}</strong> · {dateTime(r.reserved_for)} · {r.people} pers.
                    </span>
                    <StatusBadge status={r.status === "confirmed" ? "confirmed" : r.status === "requested" ? "pending" : "cancelled"} label={RES_LABEL[r.status]} />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune réservation.</Empty>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
