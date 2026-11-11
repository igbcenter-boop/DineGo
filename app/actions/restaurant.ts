"use server";

import { redirect } from "next/navigation";
import { requireMyRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIGITAL_METHODS, msg } from "@/lib/format";
import { uploadImage } from "@/lib/storage";
import { audit, notify, notifyAdmins } from "@/lib/notify";
import { cancelOrder, completeIfSettled, markPaymentConfirmed, markPaymentFailed, setOrderStatus } from "@/lib/orders";
import { confirmCashReceipt, proposeMission, requestNetworkCouriers } from "@/lib/operations";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (fd: FormData, fallback: string) => {
  const b = s(fd, "back");
  return b.startsWith("/restaurant") ? b : fallback;
};

async function myOrder(orderId: string) {
  const ctx = await requireMyRestaurant();
  const { data: o } = await createAdminClient().from("orders").select("*").eq("id", orderId).eq("restaurant_id", ctx.restaurant.id).single();
  if (!o) redirect(msg("/restaurant/commandes", "error", "Commande introuvable."));
  return { ...ctx, o };
}

// ---------------------------------------------------------------- Profil
export async function updateRestaurant(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  const path = "/restaurant/parametres";
  let logo: string | null = null;
  let cover: string | null = null;
  try {
    logo = await uploadImage(fd.get("logo"), "logos");
    cover = await uploadImage(fd.get("cover"), "covers");
  } catch (e) {
    redirect(msg(path, "error", (e as Error).message));
  }
  const update: Record<string, unknown> = {
    name: s(fd, "name") || restaurant.name,
    manager_name: s(fd, "manager_name") || restaurant.manager_name,
    phone: s(fd, "phone") || restaurant.phone,
    address: s(fd, "address") || restaurant.address,
    city: s(fd, "city") || restaurant.city,
    zone_id: s(fd, "zone_id") || null,
    category_id: s(fd, "category_id") || null,
    cuisine_type: s(fd, "cuisine_type") || null,
    description: s(fd, "description") || null,
    opening_hours: s(fd, "opening_hours") || null,
    opens_at: s(fd, "opens_at") || null,
    closes_at: s(fd, "closes_at") || null,
    delivery_zones: s(fd, "delivery_zones") || null,
    delivery_conditions: s(fd, "delivery_conditions") || null,
    price_level: Number(s(fd, "price_level")) || 2,
    offers_delivery: fd.get("offers_delivery") === "on",
    offers_pickup: fd.get("offers_pickup") === "on",
    accepts_scheduled: fd.get("accepts_scheduled") === "on",
    accepts_reservations: fd.get("accepts_reservations") === "on",
    financial_info: s(fd, "financial_info") || null,
  };
  if (!update.offers_delivery && !update.offers_pickup) redirect(msg(path, "error", "Proposez au moins la livraison ou le retrait."));
  if (logo) update.logo_url = logo;
  if (cover) update.cover_url = cover;
  await createAdminClient().from("restaurants").update(update).eq("id", restaurant.id);
  redirect(msg(path, "ok", "Informations enregistrées."));
}

export async function toggleOpen(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  await createAdminClient().from("restaurants").update({ is_open: !restaurant.is_open }).eq("id", restaurant.id);
  redirect(msg(back(fd, "/restaurant"), "ok", restaurant.is_open ? "Établissement indiqué comme fermé." : "Établissement ouvert aux commandes."));
}

/** Choix du bénéficiaire de l'encaissement (§8) et de la fréquence de reversement (§9) — historisés et non rétroactifs. */
export async function updateFinancialSettings(fd: FormData) {
  const { profile, restaurant } = await requireMyRestaurant();
  const mode = s(fd, "collection_mode") === "restaurant" ? "restaurant" : "dinego";
  const freq = s(fd, "remittance_frequency") === "daily" ? "daily" : "weekly";
  const db = createAdminClient();
  const changes = [];
  if (mode !== restaurant.collection_mode) changes.push({ field: "collection_mode", old_value: restaurant.collection_mode, new_value: mode });
  if (freq !== restaurant.remittance_frequency) changes.push({ field: "remittance_frequency", old_value: restaurant.remittance_frequency, new_value: freq });
  if (!changes.length) redirect(msg("/restaurant/parametres#finances", "ok", "Aucun changement."));
  await db.from("restaurants").update({ collection_mode: mode, remittance_frequency: freq }).eq("id", restaurant.id);
  await db.from("restaurant_setting_changes").insert(changes.map((c) => ({ ...c, restaurant_id: restaurant.id, changed_by: profile.id })));
  await audit(profile.id, "update_financial_settings", "restaurant", restaurant.id, changes);
  redirect(msg("/restaurant/parametres#finances", "ok", "Paramètres enregistrés. Ils s'appliquent aux nouvelles commandes et aux nouvelles échéances uniquement."));
}

// ---------------------------------------------------------------- Menu
export async function addMenuCategory(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  const name = s(fd, "name");
  if (!name) redirect(msg("/restaurant/menu", "error", "Nom de rubrique requis."));
  await createAdminClient().from("menu_categories").insert({ restaurant_id: restaurant.id, name, sort: Number(s(fd, "sort")) || 100 });
  redirect(msg("/restaurant/menu", "ok", "Rubrique ajoutée."));
}

export async function deleteMenuCategory(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  await createAdminClient().from("menu_categories").delete().eq("id", s(fd, "id")).eq("restaurant_id", restaurant.id);
  redirect(msg("/restaurant/menu", "ok", "Rubrique supprimée (les plats sont conservés)."));
}

function parseOptions(text: string) {
  // Une option par ligne : « Nom : prix »
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, price] = l.split(/[:=]/);
      return { name: name.trim(), price: Math.max(0, Math.round(Number((price ?? "0").replace(/[^\d]/g, "")) || 0)) };
    })
    .filter((o) => o.name);
}

export async function saveProduct(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  const path = "/restaurant/menu";
  const id = s(fd, "id");
  const name = s(fd, "name");
  const price = Math.round(Number(s(fd, "price")));
  if (!name || !(price >= 0)) redirect(msg(path, "error", "Nom et prix valides requis."));
  let photo: string | null = null;
  try {
    photo = await uploadImage(fd.get("photo"), `products/${restaurant.id}`);
  } catch (e) {
    redirect(msg(path, "error", (e as Error).message));
  }
  const row: Record<string, unknown> = {
    restaurant_id: restaurant.id,
    name,
    price,
    description: s(fd, "description") || null,
    menu_category_id: s(fd, "menu_category_id") || null,
    available: fd.get("available") === "on",
    is_combo: fd.get("is_combo") === "on",
    options: parseOptions(s(fd, "options")),
  };
  if (photo) row.photo_url = photo;
  const db = createAdminClient();
  if (id) await db.from("products").update(row).eq("id", id).eq("restaurant_id", restaurant.id);
  else await db.from("products").insert(row);
  redirect(msg(path, "ok", id ? "Plat modifié." : "Plat ajouté."));
}

export async function toggleProduct(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  const db = createAdminClient();
  const { data: p } = await db.from("products").select("available").eq("id", s(fd, "id")).eq("restaurant_id", restaurant.id).single();
  if (p) await db.from("products").update({ available: !p.available }).eq("id", s(fd, "id")).eq("restaurant_id", restaurant.id);
  redirect(msg("/restaurant/menu", "ok", p?.available ? "Plat rendu indisponible." : "Plat de nouveau disponible."));
}

export async function deleteProduct(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  await createAdminClient().from("products").delete().eq("id", s(fd, "id")).eq("restaurant_id", restaurant.id);
  redirect(msg("/restaurant/menu", "ok", "Plat supprimé."));
}

// ---------------------------------------------------------------- Promotions
export async function savePromotion(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  const path = "/restaurant/promotions";
  const pct = Math.round(Number(s(fd, "discount_percent")));
  const conditions = s(fd, "conditions");
  if (!s(fd, "title") || !(pct >= 1 && pct <= 90) || !conditions) redirect(msg(path, "error", "Titre, réduction (1 à 90 %) et conditions sont obligatoires."));
  const productId = s(fd, "product_id") || null;
  if (productId) {
    const { data: p } = await createAdminClient().from("products").select("id").eq("id", productId).eq("restaurant_id", restaurant.id).maybeSingle();
    if (!p) redirect(msg(path, "error", "Produit invalide."));
  }
  await createAdminClient().from("promotions").insert({
    restaurant_id: restaurant.id,
    product_id: productId,
    title: s(fd, "title"),
    description: s(fd, "description") || null,
    conditions,
    discount_percent: pct,
    min_order: Math.max(0, Math.round(Number(s(fd, "min_order")) || 0)),
    starts_at: s(fd, "starts_at") ? new Date(s(fd, "starts_at")).toISOString() : new Date().toISOString(),
    ends_at: s(fd, "ends_at") ? new Date(s(fd, "ends_at")).toISOString() : null,
  });
  redirect(msg(path, "ok", "Promotion publiée."));
}

export async function togglePromotion(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  const db = createAdminClient();
  const { data: p } = await db.from("promotions").select("active").eq("id", s(fd, "id")).eq("restaurant_id", restaurant.id).single();
  if (p) await db.from("promotions").update({ active: !p.active }).eq("id", s(fd, "id")).eq("restaurant_id", restaurant.id);
  redirect(msg("/restaurant/promotions", "ok", "Promotion mise à jour."));
}

export async function deletePromotion(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  await createAdminClient().from("promotions").delete().eq("id", s(fd, "id")).eq("restaurant_id", restaurant.id);
  redirect(msg("/restaurant/promotions", "ok", "Promotion supprimée."));
}

// ---------------------------------------------------------------- Commandes (§5.4)
export async function acceptOrder(fd: FormData) {
  const { profile, o } = await myOrder(s(fd, "order_id"));
  if (!["sent", "received"].includes(o.status)) redirect(msg("/restaurant/commandes", "error", "Commande déjà traitée."));
  const minutes = Math.max(5, Math.min(240, Math.round(Number(s(fd, "prep_minutes")) || 20)));
  if (o.status === "sent") await setOrderStatus(o.id, "received", profile.id);
  await setOrderStatus(o.id, "accepted", profile.id, `Délai de préparation : ${minutes} min`, { prep_minutes: minutes });
  redirect(msg("/restaurant/commandes", "ok", `Commande ${o.code} acceptée.`));
}

export async function refuseOrder(fd: FormData) {
  const { profile, o } = await myOrder(s(fd, "order_id"));
  const reason = s(fd, "reason");
  if (!reason) redirect(msg("/restaurant/commandes", "error", "Le motif du refus est obligatoire."));
  if (!["sent", "received"].includes(o.status)) redirect(msg("/restaurant/commandes", "error", "Commande déjà traitée."));
  await setOrderStatus(o.id, "refused", profile.id, reason, { refuse_reason: reason });
  const db = createAdminClient();
  if (o.payment_status === "pending") {
    await db.from("orders").update({ payment_status: "cancelled" }).eq("id", o.id);
    await db.from("payments").update({ status: "cancelled" }).eq("order_id", o.id).eq("status", "pending");
  } else if (o.payment_status === "confirmed") {
    await db.from("refunds").insert({ order_id: o.id, amount: o.total, reason: `Refus du restaurant : ${reason}` });
    await notifyAdmins({ title: "Remboursement à traiter", body: `Commande ${o.code} refusée après paiement.`, link: "/admin/reclamations#remboursements" });
  }
  redirect(msg("/restaurant/commandes", "ok", `Commande ${o.code} refusée.`));
}

export async function advanceOrder(fd: FormData) {
  const { profile, restaurant, o } = await myOrder(s(fd, "order_id"));
  const step = s(fd, "step");
  const path = "/restaurant/commandes";
  const db = createAdminClient();
  const ownCourier = o.courier_id
    ? (await db.from("couriers").select("network, user_id").eq("id", o.courier_id).single()).data
    : null;
  const restaurantDrives = ownCourier?.network === "restaurant" && !ownCourier.user_id;

  if (step === "preparing" && o.status === "accepted") await setOrderStatus(o.id, "preparing", profile.id);
  else if (step === "ready" && ["accepted", "preparing"].includes(o.status)) {
    await setOrderStatus(o.id, "ready", profile.id);
    await setOrderStatus(o.id, "awaiting_pickup", profile.id, o.mode === "delivery" ? "En attente du livreur" : "En attente du client");
  } else if (step === "delivering" && o.mode === "delivery" && o.status === "awaiting_pickup" && restaurantDrives) {
    await setOrderStatus(o.id, "delivering", profile.id);
    await db.from("delivery_missions").update({ status: "picked_up" }).eq("order_id", o.id).eq("courier_id", o.courier_id);
  } else if (step === "handed_over" && ((o.mode === "pickup" && o.status === "awaiting_pickup") || (restaurantDrives && o.status === "delivering"))) {
    await setOrderStatus(o.id, "handed_over", profile.id);
    if (o.mode === "delivery") await db.from("delivery_missions").update({ status: "delivered" }).eq("order_id", o.id).eq("courier_id", o.courier_id);
    await completeIfSettled(o.id, profile.id);
  } else redirect(msg(path, "error", "Action non disponible à cette étape."));
  void restaurant;
  redirect(msg(path, "ok", `Commande ${o.code} mise à jour.`));
}

export async function reportNotDelivered(fd: FormData) {
  const { profile, o } = await myOrder(s(fd, "order_id"));
  const reason = s(fd, "reason");
  if (!reason) redirect(msg("/restaurant/commandes", "error", "Motif requis."));
  await createAdminClient().from("incidents").insert({ order_id: o.id, reported_by: profile.id, type: "non_livree", reason });
  await setOrderStatus(o.id, "not_delivered", profile.id, reason);
  await notifyAdmins({ title: "Incident de livraison", body: `${o.code} : ${reason}`, link: "/admin/reclamations" });
  redirect(msg("/restaurant/commandes", "ok", "Incident enregistré."));
}

export async function cancelByRestaurant(fd: FormData) {
  const { profile, o } = await myOrder(s(fd, "order_id"));
  const reason = s(fd, "reason") || "Annulée par le restaurant";
  if (["completed", "cancelled", "refused", "handed_over"].includes(o.status)) redirect(msg("/restaurant/commandes", "error", "Commande non annulable."));
  await cancelOrder(o.id, profile.id, reason);
  redirect(msg("/restaurant/commandes", "ok", "Commande annulée."));
}

/** Confirmation d'un encaissement en espèces reçu par le restaurant (retrait, ou livreur propre sans compte). */
export async function restaurantConfirmCash(fd: FormData) {
  const { profile, o } = await myOrder(s(fd, "order_id"));
  const res = await confirmCashReceipt(o.id, profile, Math.round(Number(s(fd, "amount"))), s(fd, "reference") || null);
  redirect(msg(back(fd, "/restaurant/commandes"), res.error ? "error" : "ok", res.error ?? "Encaissement confirmé."));
}

/** Vérification d'un paiement numérique quand le restaurant est le bénéficiaire de l'encaissement. */
export async function restaurantVerifyPayment(fd: FormData) {
  const { profile, o } = await myOrder(s(fd, "order_id"));
  const path = back(fd, "/restaurant/finances");
  const { data: f } = await createAdminClient().from("order_financials").select("collector").eq("order_id", o.id).single();
  if (f?.collector !== "restaurant" || !DIGITAL_METHODS.includes(o.payment_method)) redirect(msg(path, "error", "Ce paiement est vérifié par DineGo."));
  if (s(fd, "decision") === "fail") await markPaymentFailed(o.id, profile.id);
  else await markPaymentConfirmed(o.id, profile.id, s(fd, "provider_reference") || null);
  redirect(msg(path, "ok", "Paiement mis à jour."));
}

// ---------------------------------------------------------------- Livreurs (§5.5, §6.2)
export async function addCourier(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  const path = "/restaurant/livreurs";
  const full_name = s(fd, "full_name");
  const phone = s(fd, "phone");
  if (!full_name || !phone) redirect(msg(path, "error", "Nom et téléphone requis."));
  const db = createAdminClient();
  let userId: string | null = null;
  const email = s(fd, "email").toLowerCase();
  const password = s(fd, "password");
  if (email) {
    if (password.length < 8) redirect(msg(path, "error", "Mot de passe de 8 caractères minimum pour créer l'accès du livreur."));
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: "livreur", full_name, phone } });
    if (error || !data.user) redirect(msg(path, "error", "Accès non créé : " + (error?.message ?? "")));
    userId = data.user.id;
  }
  const { error } = await db.from("couriers").insert({
    user_id: userId,
    restaurant_id: restaurant.id,
    network: "restaurant",
    full_name,
    phone,
    zone_id: s(fd, "zone_id") || restaurant.zone_id,
    vehicle: s(fd, "vehicle") || null,
    status: "active",
  });
  if (error) redirect(msg(path, "error", error.message));
  redirect(msg(path, "ok", userId ? "Livreur ajouté avec son accès à l'espace livreur." : "Livreur ajouté."));
}

export async function toggleMyCourier(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  const db = createAdminClient();
  const { data: c } = await db.from("couriers").select("status").eq("id", s(fd, "id")).eq("restaurant_id", restaurant.id).single();
  if (c) await db.from("couriers").update({ status: c.status === "active" ? "suspended" : "active" }).eq("id", s(fd, "id")).eq("restaurant_id", restaurant.id);
  redirect(msg("/restaurant/livreurs", "ok", "Livreur mis à jour."));
}

export async function assignCourier(fd: FormData) {
  const { restaurant, o } = await myOrder(s(fd, "order_id"));
  const courierId = s(fd, "courier_id");
  const path = "/restaurant/commandes";
  if (o.mode !== "delivery") redirect(msg(path, "error", "Commande à retirer sur place."));
  if (courierId === "network") {
    const res = await requestNetworkCouriers(o.id);
    redirect(msg(path, res.error ? "error" : "ok", res.error ?? `Mission proposée à ${res.count} livreur(s) DineGo.`));
  }
  const { data: c } = await createAdminClient().from("couriers").select("id, status").eq("id", courierId).eq("restaurant_id", restaurant.id).single();
  if (!c || c.status !== "active") redirect(msg(path, "error", "Livreur indisponible."));
  const res = await proposeMission(o.id, c.id);
  redirect(msg(path, res.error ? "error" : "ok", res.error ?? (res.autoAccept ? "Livreur affecté." : "Mission proposée au livreur.")));
}

export async function payCourierEarning(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  const db = createAdminClient();
  // La rémunération doit porter sur une commande de CE restaurant et lui incomber
  const { data: e } = await db
    .from("courier_earnings")
    .select("id, paid_by, couriers(user_id), orders!inner(restaurant_id)")
    .eq("id", s(fd, "id"))
    .eq("orders.restaurant_id", restaurant.id)
    .maybeSingle();
  if (!e || e.paid_by !== "restaurant") redirect(msg("/restaurant/livreurs", "error", "Rémunération introuvable."));
  const c = e.couriers as unknown as { user_id: string | null } | null;
  await db.from("courier_earnings").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", e.id);
  if (c?.user_id) await notify([c.user_id], { title: "Rémunération réglée", body: "Le restaurant a réglé une livraison.", link: "/livreur/remunerations" });
  redirect(msg("/restaurant/livreurs", "ok", "Rémunération marquée comme réglée."));
}

// ---------------------------------------------------------------- Reversements (§9)
export async function recordSettlementPayment(fd: FormData) {
  const { profile, restaurant } = await requireMyRestaurant();
  const path = "/restaurant/reversements";
  const db = createAdminClient();
  const { data: st } = await db.from("settlements").select("*").eq("id", s(fd, "settlement_id")).eq("restaurant_id", restaurant.id).eq("direction", "to_dinego").single();
  const amount = Math.round(Number(s(fd, "amount")));
  const proof = s(fd, "proof");
  if (!st) redirect(msg(path, "error", "Échéance introuvable."));
  if (!(amount > 0) || amount > st.amount_due - st.amount_paid) redirect(msg(path, "error", "Montant invalide."));
  if (!proof) redirect(msg(path, "error", "Une preuve de paiement (référence) est obligatoire."));
  await db.from("settlement_payments").insert({ settlement_id: st.id, amount, proof, recorded_by: profile.id });
  const paid = st.amount_paid + amount;
  await db.from("settlements").update({ amount_paid: paid, status: paid >= st.amount_due ? "paid" : st.status === "late" ? "late" : "partial" }).eq("id", st.id);
  await notifyAdmins({ title: "Reversement déclaré", body: `${restaurant.name} : ${amount} FCFA (réf. ${proof})`, link: "/admin/finances#reversements" });
  redirect(msg(path, "ok", "Reversement enregistré."));
}

// ---------------------------------------------------------------- Réservations (§17.2)
export async function answerReservation(fd: FormData) {
  const { restaurant } = await requireMyRestaurant();
  const status = s(fd, "decision") === "confirmed" ? "confirmed" : "declined";
  const db = createAdminClient();
  const { data: r } = await db.from("reservations").update({ status }).eq("id", s(fd, "id")).eq("restaurant_id", restaurant.id).select("client_id").single();
  if (r) await notify([r.client_id], { title: status === "confirmed" ? "Réservation confirmée" : "Réservation refusée", body: restaurant.name, link: "/compte#reservations" });
  redirect(msg("/restaurant/reservations", "ok", "Réponse envoyée au client."));
}
