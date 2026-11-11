"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildQuote, type CartInput } from "@/lib/checkout";
import { DIGITAL_METHODS, fcfa, msg } from "@/lib/format";
import { notify, notifyAdmins, notifyRestaurantOwner } from "@/lib/notify";
import { cancelOrder } from "@/lib/orders";

const METHODS = ["orange_money", "moov_money", "other_mobile_money", "card", "cash"];

/** Devis affiché au client avant validation : seuls les montants qui le concernent sont renvoyés (§7.3). */
export type Quote =
  | { ok: false; errors: string[] }
  | {
      ok: boolean;
      errors: string[];
      open: boolean;
      restaurant: { name: string; offers_delivery: boolean; offers_pickup: boolean; accepts_scheduled: boolean };
      subtotal: number;
      discount: number;
      deliveryFee: number;
      managementFee: number;
      total: number;
    };

export async function quoteOrder(cart: CartInput, mode: "delivery" | "pickup", zoneId: string | null): Promise<Quote> {
  const q = await buildQuote(cart, mode, zoneId);
  if (!("lines" in q) || !q.restaurant || !q.breakdown) return { ok: false, errors: q.errors };
  return {
    ok: q.ok,
    errors: q.errors,
    open: q.open,
    restaurant: {
      name: q.restaurant.name,
      offers_delivery: q.restaurant.offers_delivery,
      offers_pickup: q.restaurant.offers_pickup,
      accepts_scheduled: q.restaurant.accepts_scheduled,
    },
    subtotal: q.subtotal,
    discount: q.discount,
    deliveryFee: q.breakdown.deliveryFee,
    managementFee: q.breakdown.managementFee,
    total: q.breakdown.total,
  };
}

export async function placeOrder(fd: FormData) {
  const profile = await requireRole("client", "/commande");
  const back = "/commande";
  let cart: CartInput;
  try {
    cart = JSON.parse(String(fd.get("cart") ?? "{}"));
  } catch {
    redirect(msg(back, "error", "Panier illisible."));
  }
  const mode = fd.get("mode") === "pickup" ? "pickup" : "delivery";
  const method = String(fd.get("payment_method") ?? "");
  if (!METHODS.includes(method)) redirect(msg(back, "error", "Choisissez un moyen de paiement."));
  const phone = String(fd.get("contact_phone") ?? "").trim() || profile.phone || "";
  if (!phone) redirect(msg(back, "error", "Un numéro de téléphone est requis."));

  const db = createAdminClient();
  let address: string | null = null;
  let zoneId: string | null = String(fd.get("zone_id") ?? "") || null;
  if (mode === "delivery") {
    const addressId = String(fd.get("address_id") ?? "");
    if (addressId && addressId !== "new") {
      const { data: a } = await db.from("addresses").select("*").eq("id", addressId).eq("user_id", profile.id).single();
      if (a) address = `${a.details}, ${a.zone ? a.zone + ", " : ""}${a.city}`;
    } else {
      const details = String(fd.get("new_details") ?? "").trim();
      const city = String(fd.get("new_city") ?? "").trim();
      if (details && city) {
        address = `${details}, ${city}`;
        if (fd.get("save_address") === "on") {
          const { data: z } = zoneId ? await db.from("zones").select("name").eq("id", zoneId).single() : { data: null };
          await db.from("addresses").insert({ user_id: profile.id, label: "Adresse", city, zone: z?.name ?? null, details, phone });
        }
      }
    }
    if (!address) redirect(msg(back, "error", "Indiquez votre adresse de livraison."));
  } else {
    zoneId = null;
  }

  const q = await buildQuote(cart, mode, zoneId);
  if (!q.ok || !("lines" in q) || !q.restaurant) redirect(msg(back, "error", q.errors.join(" ")));
  if (!q.open && !fd.get("scheduled_for")) redirect(msg(back, "error", "Le restaurant est actuellement fermé. Programmez votre commande ou revenez plus tard."));

  let scheduledFor: string | null = null;
  const sched = String(fd.get("scheduled_for") ?? "");
  if (sched) {
    if (!q.restaurant.accepts_scheduled) redirect(msg(back, "error", "Ce restaurant n'accepte pas les commandes programmées."));
    const d = new Date(sched);
    if (isNaN(d.getTime()) || d.getTime() < Date.now() + 15 * 60_000) redirect(msg(back, "error", "Choisissez une heure au moins 15 minutes plus tard."));
    scheduledFor = d.toISOString();
  }

  const b = q.breakdown;
  const collector = q.restaurant.collection_mode === "restaurant" ? "restaurant" : "dinego";

  const { data: order, error } = await db
    .from("orders")
    .insert({
      client_id: profile.id,
      restaurant_id: q.restaurant.id,
      mode,
      address,
      zone_id: zoneId,
      contact_phone: phone,
      notes: String(fd.get("notes") ?? "").trim() || null,
      scheduled_for: scheduledFor,
      payment_method: method,
      subtotal: q.subtotal,
      discount: q.discount,
      delivery_fee: b.deliveryFee,
      management_fee: b.managementFee,
      total: b.total,
    })
    .select("id, code")
    .single();
  if (error || !order) redirect(msg(back, "error", "Commande non enregistrée : " + error?.message));

  await db.from("order_items").insert(q.lines.map((l) => ({ ...l, order_id: order.id })));
  await db.from("order_status_history").insert({ order_id: order.id, status: "sent", actor_id: profile.id });
  // Ventilation figée au moment de la confirmation : jamais recalculée rétroactivement (§7.4, §8.4)
  await db.from("order_financials").insert({
    order_id: order.id,
    restaurant_id: q.restaurant.id,
    fee_setting_id: q.fee?.id ?? null,
    collection_mode: q.restaurant.collection_mode,
    collector,
    commission_percent: b.commissionPercent,
    restaurant_share: b.restaurantShare,
    courier_share: b.courierShare,
    dinego_share: b.dinegoShare,
    expected_amount: b.total,
  });
  await db.from("payments").insert({ order_id: order.id, amount: b.total, method, status: "pending", beneficiary: collector });

  await notify([profile.id], {
    title: `Commande ${order.code} envoyée`,
    body: `Montant total : ${fcfa(b.total)}. Vous serez notifié à chaque étape.`,
    link: `/compte/commandes/${order.id}`,
  });
  await notify([q.restaurant.owner_id], {
    title: `Nouvelle commande ${order.code}`,
    body: `${q.lines.length} article(s) · ${fcfa(b.total)} · ${mode === "delivery" ? "Livraison" : "Retrait"}${scheduledFor ? " · programmée" : ""}`,
    link: "/restaurant/commandes",
  });
  redirect(`/compte/commandes/${order.id}?placed=1`);
}

async function loadClientOrder(orderId: string) {
  const profile = await requireRole("client");
  const { data: o } = await createAdminClient().from("orders").select("*").eq("id", orderId).eq("client_id", profile.id).single();
  if (!o) redirect(msg("/compte", "error", "Commande introuvable."));
  return { profile, o };
}

/** Le client transmet la référence de sa transaction Mobile Money : le paiement reste « en attente » jusqu'à vérification (§11.1). */
export async function submitPaymentReference(fd: FormData) {
  const orderId = String(fd.get("order_id"));
  const ref = String(fd.get("reference") ?? "").trim();
  const { o } = await loadClientOrder(orderId);
  const path = `/compte/commandes/${orderId}`;
  if (!DIGITAL_METHODS.includes(o.payment_method)) redirect(msg(path, "error", "Paiement en espèces : rien à transmettre."));
  if (ref.length < 4) redirect(msg(path, "error", "Référence de transaction invalide."));
  const db = createAdminClient();
  await db.from("payments").update({ reference: ref }).eq("order_id", orderId).eq("status", "pending");
  const { data: f } = await db.from("order_financials").select("collector").eq("order_id", orderId).single();
  const note = { title: `Paiement à vérifier — ${o.code}`, body: `Référence ${ref} · ${fcfa(o.total)}`, link: "" };
  if (f?.collector === "restaurant") await notifyRestaurantOwner(o.restaurant_id, { ...note, link: "/restaurant/finances#paiements" });
  else await notifyAdmins({ ...note, link: "/admin/finances#paiements" });
  redirect(msg(path, "ok", "Référence transmise. Le paiement sera confirmé après vérification auprès de l'opérateur."));
}

/** Annulation par le client : possible tant que le restaurant n'a pas accepté (§15.1). */
export async function cancelOrderByClient(fd: FormData) {
  const orderId = String(fd.get("order_id"));
  const reason = String(fd.get("reason") ?? "").trim() || "Annulée par le client";
  const { profile, o } = await loadClientOrder(orderId);
  const path = `/compte/commandes/${orderId}`;
  if (!["sent", "received"].includes(o.status)) redirect(msg(path, "error", "La commande a déjà été acceptée : contactez l'assistance pour l'annuler."));
  await cancelOrder(orderId, profile.id, reason);
  redirect(msg(path, "ok", "Commande annulée."));
}

export async function submitReview(fd: FormData) {
  const orderId = String(fd.get("order_id"));
  const { profile, o } = await loadClientOrder(orderId);
  const path = `/compte/commandes/${orderId}`;
  if (o.status !== "completed") redirect(msg(path, "error", "Vous pourrez évaluer la commande une fois terminée."));
  const rr = Number(fd.get("rating_restaurant"));
  const rs = Number(fd.get("rating_service"));
  if (![rr, rs].every((n) => n >= 1 && n <= 5)) redirect(msg(path, "error", "Note invalide."));
  const { error } = await createAdminClient().from("reviews").insert({
    order_id: orderId,
    restaurant_id: o.restaurant_id,
    client_id: profile.id,
    author_name: profile.full_name.split(" ")[0] || null,
    rating_restaurant: rr,
    rating_service: rs,
    comment: String(fd.get("comment") ?? "").trim() || null,
  });
  if (error) redirect(msg(path, "error", "Vous avez déjà évalué cette commande."));
  await notifyRestaurantOwner(o.restaurant_id, { title: "Nouvelle évaluation", body: `${rr}/5 pour la commande ${o.code}`, link: "/restaurant" });
  revalidatePath(path);
  redirect(msg(path, "ok", "Merci pour votre avis !"));
}

/** Réclamation client (§15.3), avec ou sans commande associée. */
export async function submitComplaint(fd: FormData) {
  const profile = await getProfile();
  const back = String(fd.get("back") ?? "/aide");
  if (!profile) redirect(`/connexion?next=${encodeURIComponent(back)}`);
  const orderId = String(fd.get("order_id") ?? "") || null;
  const type = String(fd.get("type") ?? "autre");
  const description = String(fd.get("description") ?? "").trim();
  if (description.length < 5) redirect(msg(back, "error", "Décrivez le problème en quelques mots."));
  const db = createAdminClient();
  let restaurantId: string | null = null;
  if (orderId) {
    const { data: o } = await db.from("orders").select("id, client_id, restaurant_id").eq("id", orderId).single();
    if (!o || o.client_id !== profile.id) redirect(msg(back, "error", "Commande introuvable."));
    restaurantId = o.restaurant_id;
  }
  await db.from("complaints").insert({ order_id: orderId, client_id: profile.id, type, description });
  await notifyAdmins({ title: "Nouvelle réclamation", body: description.slice(0, 120), link: "/admin/reclamations" });
  if (restaurantId) await notifyRestaurantOwner(restaurantId, { title: "Incident signalé par un client", body: description.slice(0, 120), link: "/restaurant/commandes" });
  redirect(msg(back, "ok", "Réclamation enregistrée. Notre équipe vous répondra rapidement."));
}
