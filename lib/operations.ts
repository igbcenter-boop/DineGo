import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyAdmins, notifyRestaurantOwner } from "@/lib/notify";
import { completeIfSettled } from "@/lib/orders";
import { fcfa } from "@/lib/format";
import type { Profile } from "@/lib/auth";

/**
 * Confirmation numérique d'un encaissement en espèces (§10).
 * Une seule confirmation par commande (contrainte d'unicité en base) ;
 * tout écart avec le montant attendu ouvre une anomalie suivie par l'administration.
 */
export async function confirmCashReceipt(orderId: string, actor: Profile, amount: number, reference: string | null) {
  const db = createAdminClient();
  const { data: o } = await db.from("orders").select("id, code, total, payment_method, payment_status, restaurant_id, status").eq("id", orderId).single();
  if (!o) return { error: "Commande introuvable." };
  if (o.payment_method !== "cash") return { error: "Cette commande n'est pas payée en espèces." };
  if (["cancelled", "refused"].includes(o.status)) return { error: "Commande annulée ou refusée." };
  if (!(amount > 0)) return { error: "Montant invalide." };

  const { data: conf, error } = await db
    .from("cash_confirmations")
    .insert({ order_id: orderId, amount, confirmed_by: actor.id, confirmer_role: actor.role, reference })
    .select("id")
    .single();
  if (error || !conf) {
    return { error: error?.code === "23505" ? "L'encaissement de cette commande a déjà été confirmé." : "Confirmation impossible : " + error?.message };
  }

  await db.from("payments").update({ status: "confirmed", confirmed_by: actor.id, reference }).eq("order_id", orderId).eq("status", "pending");
  await db.from("orders").update({ payment_status: "confirmed" }).eq("id", orderId);

  if (amount !== o.total) {
    await db.from("anomalies").insert({
      order_id: orderId,
      kind: "cash_gap",
      expected_amount: o.total,
      received_amount: amount,
      description: `Écart d'encaissement sur ${o.code} : attendu ${fcfa(o.total)}, reçu ${fcfa(amount)}.`,
      reported_by: actor.id,
    });
    await notifyAdmins({ title: "Écart d'encaissement", body: `${o.code} : attendu ${fcfa(o.total)}, reçu ${fcfa(amount)}.`, link: "/admin/encaissements" });
  }
  await notifyRestaurantOwner(o.restaurant_id, { title: `Encaissement confirmé — ${o.code}`, body: fcfa(amount), link: "/restaurant/finances" });
  if (actor.role === "livreur") await notify([actor.id], { title: "Confirmation d'encaissement enregistrée", body: `${o.code} : ${fcfa(amount)}` });
  await completeIfSettled(orderId, actor.id);
  return { ok: true };
}

/** Propose une mission à un livreur (propre au restaurant ou du réseau DineGo). */
export async function proposeMission(orderId: string, courierId: string) {
  const db = createAdminClient();
  const { data: c } = await db.from("couriers").select("id, user_id, network, full_name").eq("id", courierId).single();
  if (!c) return { error: "Livreur introuvable." };
  const { data: o } = await db.from("orders").select("id, code, address").eq("id", orderId).single();
  if (!o) return { error: "Commande introuvable." };
  await db.from("delivery_missions").update({ status: "cancelled" }).eq("order_id", orderId).eq("courier_id", courierId).in("status", ["proposed", "refused"]);
  // Un livreur propre sans compte est piloté par le restaurant : mission acceptée d'office
  const autoAccept = !c.user_id;
  await db.from("delivery_missions").insert({ order_id: orderId, courier_id: courierId, status: autoAccept ? "accepted" : "proposed" });
  if (autoAccept) {
    await assignCourierToOrder(orderId, courierId, c.network);
  } else {
    await notify([c.user_id], { title: "Nouvelle mission de livraison", body: `${o.code} · ${o.address ?? ""}`, link: "/livreur" });
  }
  return { ok: true, autoAccept };
}

export async function assignCourierToOrder(orderId: string, courierId: string, network: string) {
  const db = createAdminClient();
  await db.from("orders").update({ courier_id: courierId }).eq("id", orderId);
  await db.from("order_financials").update({ courier_network: network }).eq("order_id", orderId);
  // Les autres propositions en attente sont retirées
  await db.from("delivery_missions").update({ status: "cancelled" }).eq("order_id", orderId).neq("courier_id", courierId).eq("status", "proposed");
}

/** Sollicite les livreurs disponibles du réseau DineGo, selon la zone (§6.2). */
export async function requestNetworkCouriers(orderId: string) {
  const db = createAdminClient();
  const { data: o } = await db.from("orders").select("id, code, zone_id, restaurants(zone_id)").eq("id", orderId).single();
  if (!o) return { error: "Commande introuvable." };
  const restoZone = (o.restaurants as unknown as { zone_id: string | null } | null)?.zone_id;
  const zones = [restoZone, o.zone_id].filter(Boolean) as string[];
  let q = db.from("couriers").select("id, user_id").eq("network", "dinego").eq("status", "active").eq("available", true).not("user_id", "is", null);
  if (zones.length) q = q.in("zone_id", zones);
  let { data: couriers } = await q.limit(5);
  if (!couriers?.length) {
    ({ data: couriers } = await db.from("couriers").select("id, user_id").eq("network", "dinego").eq("status", "active").eq("available", true).not("user_id", "is", null).limit(5));
  }
  if (!couriers?.length) {
    await notifyAdmins({ title: "Aucun livreur DineGo disponible", body: `Commande ${o.code} en attente d'affectation.`, link: "/admin/commandes" });
    return { error: "Aucun livreur du réseau DineGo n'est disponible pour le moment. L'administration a été prévenue." };
  }
  for (const c of couriers) {
    await db.from("delivery_missions").insert({ order_id: orderId, courier_id: c.id, status: "proposed" });
    await notify([c.user_id], { title: "Nouvelle mission proposée", body: `Commande ${o.code}`, link: "/livreur" });
  }
  return { ok: true, count: couriers.length };
}
