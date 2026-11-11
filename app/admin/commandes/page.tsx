import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { adminAssignCourier, adminCancelOrder } from "@/app/actions/admin";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Commandes — administration" };

export default async function AdminOrders(props: PageProps<"/admin/commandes">) {
  await requireRole("admin");
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const restaurant = typeof sp.restaurant === "string" ? sp.restaurant : "";
  const code = typeof sp.code === "string" ? sp.code : "";
  const db = createAdminClient();
  let q = db
    .from("orders")
    .select("*, restaurants(name), order_financials(*), profiles!orders_client_id_fkey(full_name), couriers(full_name, network)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  if (restaurant) q = q.eq("restaurant_id", restaurant);
  if (code) q = q.ilike("code", `%${code}%`);
  const [{ data: orders }, { data: restaurants }, { data: network }] = await Promise.all([
    q,
    db.from("restaurants").select("id, name").order("name"),
    db.from("couriers").select("id, full_name, zones(name), available").eq("network", "dinego").eq("status", "active"),
  ]);

  return (
    <div className="container-dg mt-8 space-y-4">
      <h1 className="h1">Commandes</h1>
      <Flash searchParams={props.searchParams} />
      <form className="flex flex-wrap gap-2">
        <input name="code" defaultValue={code} placeholder="N° DG-…" aria-label="Numéro" className="input w-36" />
        <select name="status" defaultValue={status} aria-label="Statut" className="input w-52">
          <option value="">Tous les statuts</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="restaurant" defaultValue={restaurant} aria-label="Restaurant" className="input w-56">
          <option value="">Tous les restaurants</option>
          {restaurants?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button className="btn-primary">Filtrer</button>
        <Link href="/admin/commandes" className="btn-ghost">Effacer</Link>
      </form>
      {!orders?.length && <Empty>Aucune commande.</Empty>}
      <ul className="space-y-3">
        {orders?.map((o) => {
          const f = (Array.isArray(o.order_financials) ? o.order_financials[0] : o.order_financials) as Record<string, number | string> | null;
          const courier = o.couriers as unknown as { full_name: string; network: string } | null;
          return (
            <li key={o.id} className="card space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-extrabold text-violet">
                  {o.code} · {(o.restaurants as unknown as { name: string })?.name} · {(o.profiles as unknown as { full_name: string })?.full_name}
                </p>
                <div className="flex gap-1">
                  <StatusBadge status={o.status} />
                  <StatusBadge status={o.payment_status} label={`${PAYMENT_METHOD[o.payment_method]} · ${PAYMENT_STATUS[o.payment_status]}`} />
                </div>
              </div>
              <p className="text-xs text-muted">
                {dateTime(o.created_at)} · {o.mode === "delivery" ? `Livraison : ${o.address}` : "Retrait"} · {courier ? `Livreur : ${courier.full_name} (${courier.network === "dinego" ? "réseau" : "restaurant"})` : "Pas de livreur"}
              </p>
              {f && (
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-lilac/50 p-3 text-xs sm:grid-cols-6">
                  <span>Total <strong>{fcfa(o.total)}</strong></span>
                  <span>Restaurant <strong>{fcfa(Number(f.restaurant_share))}</strong></span>
                  <span>Livreur <strong>{fcfa(Number(f.courier_share))}</strong></span>
                  <span>DineGo <strong>{fcfa(Number(f.dinego_share))}</strong></span>
                  <span>Commission <strong>{String(f.commission_percent)} %</strong></span>
                  <span>Encaissé par <strong>{f.collector === "dinego" ? "DineGo" : "restaurant"}</strong></span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {o.mode === "delivery" && !o.courier_id && ["accepted", "preparing", "ready", "awaiting_pickup"].includes(o.status) && (
                  <form action={adminAssignCourier} className="flex gap-2">
                    <input type="hidden" name="order_id" value={o.id} />
                    <select name="courier_id" aria-label="Livreur du réseau" className="input w-60 py-1.5">
                      <option value="broadcast">Proposer aux livreurs disponibles</option>
                      {network?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} — {(c.zones as unknown as { name: string } | null)?.name ?? "?"} {c.available ? "" : "(indispo.)"}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="btn-violet btn-sm">Affecter</SubmitButton>
                  </form>
                )}
                {!["completed", "cancelled", "refused"].includes(o.status) && (
                  <form action={adminCancelOrder} className="flex gap-2">
                    <input type="hidden" name="order_id" value={o.id} />
                    <input name="reason" required placeholder="Motif d'annulation" aria-label="Motif" className="input w-48 py-1.5" />
                    <SubmitButton className="btn-danger btn-sm" confirm="Annuler cette commande ?">Annuler</SubmitButton>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
