import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyAdmins, notifyRestaurantOwner } from "@/lib/notify";
import { ORDER_STATUS, fcfa } from "@/lib/format";
import { addDays, iso, periodFor, settlementAmount } from "@/lib/finance";

const CLIENT_MESSAGES: Record<string, string> = {
  accepted: "Votre commande a été acceptée par le restaurant.",
  preparing: "La préparation de votre commande a commencé.",
  ready: "Votre commande est prête.",
  awaiting_pickup: "Votre commande vous attend au restaurant.",
  delivering: "Le livreur est en route avec votre commande.",
  handed_over: "Votre commande vous a été remise. Bon appétit !",
  completed: "Commande terminée. Merci d'avoir choisi DineGo !",
  refused: "Votre commande a été refusée par le restaurant.",
  cancelled: "Votre commande a été annulée.",
  not_delivered: "Votre commande n'a pas pu être livrée. Notre équipe suit l'incident.",
};

/** Change le statut d'une commande, l'historise et prévient le client. */
export async function setOrderStatus(
  orderId: string,
  status: string,
  actorId: string | null,
  note?: string | null,
  extra: Record<string, unknown> = {},
) {
  const db = createAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .update({ status, ...extra, ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}) })
    .eq("id", orderId)
    .select("id, code, client_id, restaurant_id")
    .single();
  if (error || !order) throw new Error(error?.message ?? "Commande introuvable");
  await db.from("order_status_history").insert({ order_id: orderId, status, actor_id: actorId, note: note ?? null });
  if (CLIENT_MESSAGES[status]) {
    await notify([order.client_id], {
      title: `${order.code} — ${ORDER_STATUS[status]}`,
      body: CLIENT_MESSAGES[status] + (note ? ` (${note})` : ""),
      link: `/compte/commandes/${orderId}`,
    });
  }
  if (status === "cancelled") {
    await notifyRestaurantOwner(order.restaurant_id, {
      title: `Commande ${order.code} annulée`,
      body: note ?? undefined,
      link: "/restaurant/commandes",
    });
  }
  return order;
}

/**
 * Une commande remise au client n'est « terminée » que si le paiement est
 * effectivement confirmé (§10.1 : la livraison ne vaut pas encaissement).
 */
export async function completeIfSettled(orderId: string, actorId: string | null) {
  const db = createAdminClient();
  const { data: o } = await db
    .from("orders")
    .select("id, code, status, payment_status, courier_id, mode, restaurant_id")
    .eq("id", orderId)
    .single();
  if (!o || o.status !== "handed_over" || o.payment_status !== "confirmed") return false;

  await setOrderStatus(orderId, "completed", actorId);

  const { data: f } = await db.from("order_financials").select("*").eq("order_id", orderId).single();
  if (f) {
    await db.from("order_financials").update({ collected_amount: f.expected_amount }).eq("order_id", orderId);
  }
  // Rémunération du livreur enregistrée pour chaque livraison (§6.4)
  if (o.mode === "delivery" && o.courier_id && f && f.courier_share > 0) {
    const { data: c } = await db.from("couriers").select("network, user_id").eq("id", o.courier_id).single();
    const circuit = await networkCircuit();
    const paidBy =
      c?.network === "restaurant" || (f.collector === "restaurant" && circuit === "direct_restaurant") ? "restaurant" : "dinego";
    await db
      .from("courier_earnings")
      .upsert({ courier_id: o.courier_id, order_id: orderId, amount: f.courier_share, paid_by: paidBy }, { onConflict: "order_id" });
    if (c?.user_id) {
      await notify([c.user_id], {
        title: "Rémunération enregistrée",
        body: `Livraison ${o.code} : ${f.courier_share} FCFA (${paidBy === "dinego" ? "réglés par DineGo" : "réglés par le restaurant"}).`,
        link: "/livreur/remunerations",
      });
    }
  }
  return true;
}

export async function networkCircuit(): Promise<"via_dinego" | "direct_restaurant"> {
  const { data } = await createAdminClient()
    .from("platform_settings")
    .select("value")
    .eq("key", "network_courier_payment_circuit")
    .maybeSingle();
  return data?.value === "direct_restaurant" ? "direct_restaurant" : "via_dinego";
}

async function delayDays(frequency: "daily" | "weekly") {
  const { data } = await createAdminClient()
    .from("platform_settings")
    .select("value")
    .eq("key", frequency === "daily" ? "remittance_daily_delay_days" : "remittance_weekly_delay_days")
    .maybeSingle();
  return Number(data?.value ?? (frequency === "daily" ? 1 : 3));
}

/**
 * Constitue les échéances de reversement (§9) pour les périodes closes.
 * Les commandes déjà rattachées à une échéance ne sont jamais recalculées :
 * un changement de fréquence ne s'applique qu'aux nouvelles échéances (§9.5).
 */
export async function generateSettlements(restaurantId?: string) {
  const db = createAdminClient();
  let q = db
    .from("order_financials")
    .select("order_id, restaurant_id, collector, restaurant_share, courier_share, dinego_share, courier_network, orders!inner(status, completed_at)")
    .is("settlement_id", null)
    .eq("orders.status", "completed");
  if (restaurantId) q = q.eq("restaurant_id", restaurantId);
  const { data: rows } = await q;
  const today = iso(new Date());
  const circuit = await networkCircuit();

  const restaurantIds = [...new Set((rows ?? []).map((r) => r.restaurant_id))];
  const { data: restos } = restaurantIds.length
    ? await db.from("restaurants").select("id, owner_id, name, remittance_frequency").in("id", restaurantIds)
    : { data: [] as { id: string; owner_id: string; name: string; remittance_frequency: "daily" | "weekly" }[] };
  const byId = new Map((restos ?? []).map((r) => [r.id, r]));

  type Group = { restaurantId: string; direction: "to_dinego" | "to_restaurant"; frequency: "daily" | "weekly"; start: string; end: string; amount: number; orderIds: string[] };
  const groups = new Map<string, Group>();
  for (const r of rows ?? []) {
    const resto = byId.get(r.restaurant_id);
    // @ts-expect-error relation imbriquée
    const completedAt = r.orders?.completed_at as string | null;
    if (!resto || !completedAt) continue;
    const frequency = resto.remittance_frequency;
    const period = periodFor(new Date(completedAt), frequency);
    if (period.end >= today) continue; // période non close
    const { direction, amount } = settlementAmount(r, circuit);
    const key = `${r.restaurant_id}|${direction}|${frequency}|${period.start}`;
    const g = groups.get(key) ?? { restaurantId: r.restaurant_id, direction, frequency, start: period.start, end: period.end, amount: 0, orderIds: [] as string[] };
    g.amount += amount;
    g.orderIds.push(r.order_id);
    groups.set(key, g);
  }

  let created = 0;
  for (const g of groups.values()) {
    const due = addDays(g.end, await delayDays(g.frequency));
    const { data: s, error } = await db
      .from("settlements")
      .insert({
        restaurant_id: g.restaurantId,
        direction: g.direction,
        frequency: g.frequency,
        period_start: g.start,
        period_end: g.end,
        due_date: due,
        amount_due: g.amount,
        status: g.amount === 0 ? "paid" : "pending",
      })
      .select("id")
      .single();
    if (error || !s) continue;
    await db.from("order_financials").update({ settlement_id: s.id }).in("order_id", g.orderIds);
    created++;
    const resto = byId.get(g.restaurantId);
    if (g.direction === "to_dinego" && resto) {
      await notify([resto.owner_id], {
        title: "Nouvelle échéance de reversement",
        body: `${g.amount} FCFA à reverser à DineGo avant le ${due.split("-").reverse().join("/")}.`,
        link: "/restaurant/reversements",
      });
    }
  }

  // Marquage des retards
  const { data: late } = await db
    .from("settlements")
    .update({ status: "late" })
    .lt("due_date", today)
    .in("status", ["pending", "partial"])
    .eq("direction", "to_dinego")
    .select("id, restaurant_id, amount_due, amount_paid");
  for (const s of late ?? []) {
    await notifyRestaurantOwner(s.restaurant_id, {
      title: "Retard de reversement",
      body: `Un reversement de ${s.amount_due - s.amount_paid} FCFA est en retard.`,
      link: "/restaurant/reversements",
    });
  }
  if (late?.length) {
    await notifyAdmins({ title: "Retard de reversement", body: `${late.length} échéance(s) passée(s) en retard.`, link: "/admin/finances" });
  }
  return created;
}

/** Annulation commune : statut, paiement et éventuel remboursement automatique. */
export async function cancelOrder(orderId: string, actorId: string, reason: string) {
  const db = createAdminClient();
  const { data: o } = await db.from("orders").select("id, total, payment_status").eq("id", orderId).single();
  if (!o) return;
  await setOrderStatus(orderId, "cancelled", actorId, reason, { cancel_reason: reason, cancelled_by: actorId });
  if (o.payment_status === "pending") {
    await db.from("orders").update({ payment_status: "cancelled" }).eq("id", orderId);
    await db.from("payments").update({ status: "cancelled" }).eq("order_id", orderId).eq("status", "pending");
  } else if (o.payment_status === "confirmed") {
    await db.from("refunds").insert({ order_id: orderId, amount: o.total, reason: `Annulation : ${reason}` });
    await notifyAdmins({ title: "Remboursement à traiter", body: `Commande annulée après paiement (${fcfa(o.total)}).`, link: "/admin/reclamations#remboursements" });
  }
}

/** Paiement numérique confirmé (vérification manuelle par le bénéficiaire, ou webhook du prestataire). */
export async function markPaymentConfirmed(orderId: string, actorId: string | null, providerRef?: string | null) {
  const db = createAdminClient();
  const { data: o } = await db.from("orders").select("id, code, client_id, restaurant_id, payment_status").eq("id", orderId).single();
  if (!o || o.payment_status !== "pending") return false;
  await db
    .from("payments")
    .update({ status: "confirmed", confirmed_by: actorId, provider_reference: providerRef ?? null })
    .eq("order_id", orderId)
    .eq("status", "pending");
  await db.from("orders").update({ payment_status: "confirmed" }).eq("id", orderId);
  await notify([o.client_id], { title: `Paiement confirmé — ${o.code}`, body: "Votre paiement a bien été reçu.", link: `/compte/commandes/${orderId}` });
  await notifyRestaurantOwner(o.restaurant_id, { title: `Paiement confirmé — ${o.code}`, link: "/restaurant/commandes" });
  await completeIfSettled(orderId, actorId);
  return true;
}

export async function markPaymentFailed(orderId: string, actorId: string | null) {
  const db = createAdminClient();
  const { data: o } = await db.from("orders").select("id, code, client_id, payment_status").eq("id", orderId).single();
  if (!o || o.payment_status !== "pending") return false;
  await db.from("payments").update({ status: "failed", confirmed_by: actorId }).eq("order_id", orderId).eq("status", "pending");
  await db.from("orders").update({ payment_status: "failed" }).eq("id", orderId);
  await notify([o.client_id], { title: `Paiement non reçu — ${o.code}`, body: "Le paiement n'a pas pu être vérifié. Contactez l'assistance.", link: `/compte/commandes/${orderId}` });
  await notifyAdmins({ title: "Paiement échoué", body: o.code, link: "/admin/finances" });
  return true;
}
