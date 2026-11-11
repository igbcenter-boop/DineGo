import type { Metadata } from "next";
import Link from "next/link";
import { requireMyRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { answerReservation } from "@/app/actions/restaurant";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Réservations" };

const LABEL: Record<string, string> = { requested: "En attente", confirmed: "Confirmée", declined: "Refusée", cancelled: "Annulée" };

export default async function RestaurantReservations(props: PageProps<"/restaurant/reservations">) {
  const { restaurant } = await requireMyRestaurant();
  const { data } = await createAdminClient()
    .from("reservations")
    .select("*, profiles(full_name, phone)")
    .eq("restaurant_id", restaurant.id)
    .order("reserved_for", { ascending: true });
  return (
    <div className="container-dg mt-8 space-y-4">
      <h1 className="h1">Réservations de table</h1>
      <Flash searchParams={props.searchParams} />
      {!restaurant.accepts_reservations && (
        <p className="rounded-xl bg-peach px-4 py-3 text-sm text-orange-700">
          La réservation en ligne est désactivée. <Link href="/restaurant/parametres" className="font-bold underline">Activez-la dans vos paramètres.</Link>
        </p>
      )}
      {data?.length ? (
        <ul className="space-y-2">
          {data.map((r) => {
            const c = r.profiles as unknown as { full_name: string; phone: string | null } | null;
            return (
              <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  <strong className="text-violet">{dateTime(r.reserved_for)}</strong> · {r.people} pers. · {c?.full_name} {c?.phone ? `(${c.phone})` : ""}
                  {r.note ? ` · « ${r.note} »` : ""}
                </span>
                {r.status === "requested" ? (
                  <form action={answerReservation} className="flex gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton className="btn-primary btn-sm" name="decision" value="confirmed">Confirmer</SubmitButton>
                    <SubmitButton className="btn-ghost btn-sm" name="decision" value="declined">Refuser</SubmitButton>
                  </form>
                ) : (
                  <span className="chip">{LABEL[r.status]}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>Aucune réservation.</Empty>
      )}
    </div>
  );
}
