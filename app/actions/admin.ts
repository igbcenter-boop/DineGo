"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fcfa, msg, slugify } from "@/lib/format";
import { audit, notify, notifyRestaurantOwner } from "@/lib/notify";
import { cancelOrder, generateSettlements, markPaymentConfirmed, markPaymentFailed } from "@/lib/orders";
import { proposeMission, requestNetworkCouriers } from "@/lib/operations";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string) => Math.round(Number(s(fd, k)));
const back = (fd: FormData, fallback: string) => (s(fd, "back").startsWith("/admin") ? s(fd, "back") : fallback);

async function admin() {
  return requireRole("admin");
}

// ---------------------------------------------------------------- Restaurants (§14.2)
export async function setRestaurantStatus(fd: FormData) {
  const me = await admin();
  const status = s(fd, "status");
  if (!["active", "suspended", "rejected", "pending"].includes(status)) redirect(msg("/admin/restaurants", "error", "Statut invalide."));
  const db = createAdminClient();
  const { data: r } = await db
    .from("restaurants")
    .update({ status, ...(status === "active" ? { validated_at: new Date().toISOString() } : {}) })
    .eq("id", s(fd, "id"))
    .select("id, name, owner_id")
    .single();
  if (r) {
    const label = { active: "validé et en ligne", suspended: "suspendu", rejected: "refusé", pending: "remis en attente" }[status];
    await notify([r.owner_id], { title: `Établissement ${label}`, body: s(fd, "reason") || r.name, link: "/restaurant" });
    await audit(me.id, "restaurant_status", "restaurant", r.id, { status, reason: s(fd, "reason") });
  }
  redirect(msg(back(fd, "/admin/restaurants"), "ok", "Statut mis à jour."));
}

export async function toggleFeatured(fd: FormData) {
  await admin();
  const db = createAdminClient();
  const { data: r } = await db.from("restaurants").select("featured").eq("id", s(fd, "id")).single();
  await db.from("restaurants").update({ featured: !r?.featured }).eq("id", s(fd, "id"));
  redirect(msg("/admin/restaurants", "ok", "Mise en avant mise à jour."));
}

export async function adminUpdateRestaurant(fd: FormData) {
  const me = await admin();
  const update = {
    name: s(fd, "name"),
    phone: s(fd, "phone"),
    address: s(fd, "address"),
    city: s(fd, "city"),
    category_id: s(fd, "category_id") || null,
    zone_id: s(fd, "zone_id") || null,
  };
  if (!update.name || !update.phone || !update.address || !update.city) redirect(msg("/admin/restaurants", "error", "Champs obligatoires manquants."));
  await createAdminClient().from("restaurants").update(update).eq("id", s(fd, "id"));
  await audit(me.id, "restaurant_update", "restaurant", s(fd, "id"), update);
  redirect(msg("/admin/restaurants", "ok", "Informations modifiées."));
}

// ---------------------------------------------------------------- Livreurs (§14.3)
export async function setCourierStatus(fd: FormData) {
  const me = await admin();
  const status = s(fd, "status");
  if (!["active", "suspended", "pending"].includes(status)) redirect(msg("/admin/livreurs", "error", "Statut invalide."));
  const db = createAdminClient();
  const update: Record<string, unknown> = { status };
  if (s(fd, "zone_id")) update.zone_id = s(fd, "zone_id");
  const { data: c } = await db.from("couriers").update(update).eq("id", s(fd, "id")).select("id, user_id").single();
  if (c?.user_id) await notify([c.user_id], { title: status === "active" ? "Profil livreur activé" : "Profil livreur mis à jour", body: `Statut : ${status}`, link: "/livreur" });
  await audit(me.id, "courier_status", "courier", s(fd, "id"), update);
  redirect(msg("/admin/livreurs", "ok", "Livreur mis à jour."));
}

export async function payCourierByDinego(fd: FormData) {
  const me = await admin();
  const db = createAdminClient();
  const { data: e } = await db
    .from("courier_earnings")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", s(fd, "id"))
    .eq("paid_by", "dinego")
    .select("amount, couriers(user_id)")
    .single();
  const uid = (e?.couriers as unknown as { user_id: string | null } | null)?.user_id;
  if (uid) await notify([uid], { title: "Rémunération réglée par DineGo", body: fcfa(e?.amount), link: "/livreur/remunerations" });
  await audit(me.id, "courier_paid", "courier_earning", s(fd, "id"));
  redirect(msg(back(fd, "/admin/finances"), "ok", "Rémunération réglée."));
}

// ---------------------------------------------------------------- Utilisateurs (§14.1)
export async function setUserStatus(fd: FormData) {
  const me = await admin();
  const id = s(fd, "id");
  if (id === me.id) redirect(msg("/admin/utilisateurs", "error", "Vous ne pouvez pas suspendre votre propre compte."));
  const status = s(fd, "status") === "suspended" ? "suspended" : "active";
  await createAdminClient().from("profiles").update({ status }).eq("id", id);
  await audit(me.id, "user_status", "profile", id, { status });
  redirect(msg(back(fd, "/admin/utilisateurs"), "ok", status === "suspended" ? "Compte suspendu." : "Compte réactivé."));
}

export async function createAdminAccount(fd: FormData) {
  const me = await admin();
  const email = s(fd, "email").toLowerCase();
  const password = s(fd, "password");
  const full_name = s(fd, "full_name");
  if (!email || password.length < 10 || !full_name) redirect(msg("/admin/utilisateurs", "error", "Nom, e-mail et mot de passe (10 caractères min.) requis."));
  const db = createAdminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (error || !data.user) redirect(msg("/admin/utilisateurs", "error", "Création impossible : " + error?.message));
  // Le rôle administrateur n'est jamais attribuable via l'inscription : il est posé ici, côté serveur.
  await db.from("profiles").update({ role: "admin", full_name }).eq("id", data.user.id);
  await audit(me.id, "create_admin", "profile", data.user.id, { email });
  redirect(msg("/admin/utilisateurs", "ok", "Compte administrateur créé."));
}

// ---------------------------------------------------------------- Commandes (§15)
export async function adminAssignCourier(fd: FormData) {
  await admin();
  const orderId = s(fd, "order_id");
  const courierId = s(fd, "courier_id");
  const res = courierId === "broadcast" ? await requestNetworkCouriers(orderId) : await proposeMission(orderId, courierId);
  redirect(msg(back(fd, "/admin/commandes"), res.error ? "error" : "ok", res.error ?? "Mission envoyée."));
}

export async function adminCancelOrder(fd: FormData) {
  const me = await admin();
  const reason = s(fd, "reason");
  if (!reason) redirect(msg(back(fd, "/admin/commandes"), "error", "Motif requis."));
  await cancelOrder(s(fd, "order_id"), me.id, reason);
  await audit(me.id, "order_cancel", "order", s(fd, "order_id"), { reason });
  redirect(msg(back(fd, "/admin/commandes"), "ok", "Commande annulée."));
}

// ---------------------------------------------------------------- Paiements (§11)
export async function adminVerifyPayment(fd: FormData) {
  const me = await admin();
  const orderId = s(fd, "order_id");
  const ok = s(fd, "decision") === "fail" ? await markPaymentFailed(orderId, me.id) : await markPaymentConfirmed(orderId, me.id, s(fd, "provider_reference") || null);
  await audit(me.id, "payment_" + s(fd, "decision"), "order", orderId, { provider_reference: s(fd, "provider_reference") });
  redirect(msg(back(fd, "/admin/finances"), ok ? "ok" : "error", ok ? "Paiement mis à jour." : "Paiement déjà traité."));
}

// ---------------------------------------------------------------- Reversements (§9, §13)
export async function runSettlements() {
  await admin();
  const created = await generateSettlements();
  redirect(msg("/admin/finances#reversements", "ok", `${created} nouvelle(s) échéance(s) constituée(s).`));
}

export async function adminRecordSettlementPayment(fd: FormData) {
  const me = await admin();
  const db = createAdminClient();
  const { data: st } = await db.from("settlements").select("*").eq("id", s(fd, "settlement_id")).single();
  const amount = n(fd, "amount");
  const proof = s(fd, "proof");
  if (!st || !(amount > 0) || amount > st.amount_due - st.amount_paid || !proof) redirect(msg("/admin/finances#reversements", "error", "Montant ou preuve invalide."));
  await db.from("settlement_payments").insert({ settlement_id: st.id, amount, proof, recorded_by: me.id });
  const paid = st.amount_paid + amount;
  await db.from("settlements").update({ amount_paid: paid, status: paid >= st.amount_due ? "paid" : st.status === "late" ? "late" : "partial" }).eq("id", st.id);
  await notifyRestaurantOwner(st.restaurant_id, {
    title: st.direction === "to_restaurant" ? "Reversement DineGo effectué" : "Reversement reçu par DineGo",
    body: `${fcfa(amount)} (réf. ${proof})`,
    link: "/restaurant/reversements",
  });
  await audit(me.id, "settlement_payment", "settlement", st.id, { amount, proof });
  redirect(msg("/admin/finances#reversements", "ok", "Règlement enregistré."));
}

// ---------------------------------------------------------------- Encaissements & anomalies (§10)
export async function correctCashConfirmation(fd: FormData) {
  const me = await admin();
  const reason = s(fd, "reason");
  const amount = n(fd, "amount");
  if (!reason || !(amount >= 0)) redirect(msg("/admin/encaissements", "error", "Montant et motif obligatoires."));
  const db = createAdminClient();
  const { data: c } = await db.from("cash_confirmations").select("*").eq("id", s(fd, "id")).single();
  if (!c) redirect(msg("/admin/encaissements", "error", "Confirmation introuvable."));
  await db.from("cash_corrections").insert({ confirmation_id: c.id, old_amount: c.amount, new_amount: amount, reason, corrected_by: me.id });
  await db.from("cash_confirmations").update({ amount }).eq("id", c.id);
  await audit(me.id, "cash_correction", "cash_confirmation", c.id, { from: c.amount, to: amount, reason });
  redirect(msg("/admin/encaissements", "ok", "Correction enregistrée avec son motif."));
}

export async function resolveAnomaly(fd: FormData) {
  const me = await admin();
  const status = s(fd, "status") === "rejected" ? "rejected" : s(fd, "status") === "in_progress" ? "in_progress" : "resolved";
  await createAdminClient()
    .from("anomalies")
    .update({ status, resolution: s(fd, "resolution") || null, resolved_by: me.id, resolved_at: status === "in_progress" ? null : new Date().toISOString() })
    .eq("id", s(fd, "id"));
  redirect(msg(back(fd, "/admin/encaissements"), "ok", "Anomalie mise à jour."));
}

// ---------------------------------------------------------------- Réclamations, incidents, remboursements (§15)
export async function answerComplaint(fd: FormData) {
  const me = await admin();
  const status = ["open", "in_progress", "resolved", "rejected"].includes(s(fd, "status")) ? s(fd, "status") : "in_progress";
  const response = s(fd, "response");
  const db = createAdminClient();
  const { data: c } = await db
    .from("complaints")
    .update({ status, response: response || null, responded_by: me.id, responded_at: new Date().toISOString() })
    .eq("id", s(fd, "id"))
    .select("client_id, order_id")
    .single();
  if (c && response) await notify([c.client_id], { title: "Réponse à votre réclamation", body: response, link: c.order_id ? `/compte/commandes/${c.order_id}` : "/aide" });
  redirect(msg("/admin/reclamations", "ok", "Réclamation mise à jour."));
}

export async function resolveIncident(fd: FormData) {
  await admin();
  await createAdminClient().from("incidents").update({ status: "resolved", resolution: s(fd, "resolution") || null }).eq("id", s(fd, "id"));
  redirect(msg("/admin/reclamations#incidents", "ok", "Incident clos."));
}

export async function createRefund(fd: FormData) {
  const me = await admin();
  const db = createAdminClient();
  const { data: o } = await db.from("orders").select("id, code, total").eq("code", s(fd, "order_code").toUpperCase()).single();
  const amount = n(fd, "amount");
  if (!o) redirect(msg("/admin/reclamations#remboursements", "error", "Commande introuvable."));
  if (!(amount > 0 && amount <= o.total) || !s(fd, "reason")) redirect(msg("/admin/reclamations#remboursements", "error", "Montant ou motif invalide."));
  await db.from("refunds").insert({ order_id: o.id, amount, reason: s(fd, "reason"), complaint_id: s(fd, "complaint_id") || null });
  await audit(me.id, "refund_request", "order", o.id, { amount });
  redirect(msg("/admin/reclamations#remboursements", "ok", "Demande de remboursement créée."));
}

export async function processRefund(fd: FormData) {
  const me = await admin();
  const status = s(fd, "status");
  if (!["approved", "rejected", "paid"].includes(status)) redirect(msg("/admin/reclamations#remboursements", "error", "Décision invalide."));
  const db = createAdminClient();
  const { data: r } = await db
    .from("refunds")
    .update({ status, processed_by: me.id, processing_note: s(fd, "note") || null, processed_at: new Date().toISOString() })
    .eq("id", s(fd, "id"))
    .select("order_id, amount, orders(client_id, total, code)")
    .single();
  const o = r?.orders as unknown as { client_id: string; total: number; code: string } | null;
  if (r && o && status === "paid") {
    const { data: all } = await db.from("refunds").select("amount").eq("order_id", r.order_id).eq("status", "paid");
    const refunded = (all ?? []).reduce((a, x) => a + x.amount, 0);
    const ps = refunded >= o.total ? "refunded" : "partially_refunded";
    await db.from("orders").update({ payment_status: ps }).eq("id", r.order_id);
    await db.from("payments").update({ status: ps }).eq("order_id", r.order_id).eq("status", "confirmed");
  }
  if (o) await notify([o.client_id], { title: `Remboursement ${status === "paid" ? "effectué" : status === "approved" ? "approuvé" : "refusé"} — ${o.code}`, body: fcfa(r?.amount), link: `/compte/commandes/${r?.order_id}` });
  await audit(me.id, "refund_" + status, "refund", s(fd, "id"));
  redirect(msg("/admin/reclamations#remboursements", "ok", "Remboursement mis à jour."));
}

// ---------------------------------------------------------------- Paramètres (§7.4, §14.4)
export async function saveFeeSettings(fd: FormData) {
  const me = await admin();
  const zoneRules: Record<string, { delivery_fee: number }> = {};
  const categoryRules: Record<string, { commission_percent: number }> = {};
  for (const [k, v] of fd.entries()) {
    const val = String(v).trim();
    if (!val) continue;
    if (k.startsWith("zone_fee_")) zoneRules[k.slice(9)] = { delivery_fee: Math.max(0, Math.round(Number(val))) };
    if (k.startsWith("cat_pct_")) categoryRules[k.slice(8)] = { commission_percent: Math.min(100, Math.max(0, Number(val))) };
  }
  const row = {
    commission_percent: Number(s(fd, "commission_percent")),
    management_fee: n(fd, "management_fee"),
    delivery_fee: n(fd, "delivery_fee"),
    courier_share_percent: Number(s(fd, "courier_share_percent")),
    zone_rules: zoneRules,
    category_rules: categoryRules,
    note: s(fd, "note") || null,
    created_by: me.id,
  };
  if ([row.commission_percent, row.courier_share_percent].some((x) => !(x >= 0 && x <= 100)) || !(row.delivery_fee >= 0) || !(row.management_fee >= 0)) {
    redirect(msg("/admin/parametres", "error", "Valeurs invalides."));
  }
  // Nouvelle version datée : les commandes déjà confirmées gardent leur ventilation (§7.4)
  await createAdminClient().from("fee_settings").insert(row);
  await audit(me.id, "fee_settings", "fee_settings", undefined, row);
  redirect(msg("/admin/parametres", "ok", "Nouveau paramétrage enregistré et daté. Il s'applique aux nouvelles commandes."));
}

export async function savePlatformSettings(fd: FormData) {
  const me = await admin();
  const db = createAdminClient();
  const values: Record<string, unknown> = {
    network_courier_payment_circuit: s(fd, "network_courier_payment_circuit") === "direct_restaurant" ? "direct_restaurant" : "via_dinego",
    remittance_daily_delay_days: Math.max(0, n(fd, "remittance_daily_delay_days") || 0),
    remittance_weekly_delay_days: Math.max(0, n(fd, "remittance_weekly_delay_days") || 0),
    cancellation_rules: s(fd, "cancellation_rules"),
    refund_rules: s(fd, "refund_rules"),
    notification_channels: { in_app: true, sms: fd.get("sms") === "on", email: fd.get("email") === "on" },
  };
  for (const [key, value] of Object.entries(values)) {
    await db.from("platform_settings").upsert({ key, value, updated_by: me.id, updated_at: new Date().toISOString() });
  }
  await audit(me.id, "platform_settings", "platform_settings", undefined, values);
  redirect(msg("/admin/parametres#regles", "ok", "Règles de fonctionnement enregistrées."));
}

export async function saveCategory(fd: FormData) {
  await admin();
  const name = s(fd, "name");
  if (!name) redirect(msg("/admin/parametres#categories", "error", "Nom requis."));
  const db = createAdminClient();
  const row = { name, icon: s(fd, "icon") || "🍽️", sort: n(fd, "sort") || 100, slug: slugify(name) };
  const { error } = s(fd, "id") ? await db.from("categories").update(row).eq("id", s(fd, "id")) : await db.from("categories").insert(row);
  redirect(msg("/admin/parametres#categories", error ? "error" : "ok", error ? error.message : "Catégorie enregistrée."));
}

export async function toggleCategory(fd: FormData) {
  await admin();
  const db = createAdminClient();
  const { data } = await db.from("categories").select("active").eq("id", s(fd, "id")).single();
  await db.from("categories").update({ active: !data?.active }).eq("id", s(fd, "id"));
  redirect(msg("/admin/parametres#categories", "ok", "Catégorie mise à jour."));
}

export async function saveZone(fd: FormData) {
  await admin();
  const city = s(fd, "city");
  const name = s(fd, "name");
  if (!city || !name) redirect(msg("/admin/parametres#zones", "error", "Ville et zone requises."));
  const { error } = await createAdminClient().from("zones").insert({ city, name });
  redirect(msg("/admin/parametres#zones", error ? "error" : "ok", error ? "Cette zone existe déjà." : "Zone ajoutée."));
}

export async function toggleZone(fd: FormData) {
  await admin();
  const db = createAdminClient();
  const { data } = await db.from("zones").select("active").eq("id", s(fd, "id")).single();
  await db.from("zones").update({ active: !data?.active }).eq("id", s(fd, "id"));
  redirect(msg("/admin/parametres#zones", "ok", "Zone mise à jour."));
}
