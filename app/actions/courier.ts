"use server";

import { redirect } from "next/navigation";
import { requireMyCourier } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { msg } from "@/lib/format";
import { notify, notifyAdmins, notifyRestaurantOwner } from "@/lib/notify";
import { completeIfSettled, setOrderStatus } from "@/lib/orders";
import { assignCourierToOrder, confirmCashReceipt } from "@/lib/operations";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const HOME = "/livreur";

async function active() {
  const ctx = await requireMyCourier();
  if (!ctx.courier) redirect(msg(HOME, "error", "Profil livreur introuvable."));
  if (ctx.courier.status !== "active") redirect(msg(HOME, "error", "Votre profil n'est pas encore actif."));
  return { profile: ctx.profile, courier: ctx.courier };
}

async function myMission(missionId: string) {
  const ctx = await active();
  const { data: m } = await createAdminClient().from("delivery_missions").select("*, orders(*)").eq("id", missionId).eq("courier_id", ctx.courier.id).single();
  if (!m) redirect(msg(HOME, "error", "Mission introuvable."));
  return { ...ctx, m, o: m.orders as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function toggleAvailability() {
  const { courier } = await requireMyCourier();
  if (!courier) redirect(HOME);
  await createAdminClient().from("couriers").update({ available: !courier.available }).eq("id", courier.id);
  redirect(msg(HOME, "ok", courier.available ? "Vous êtes indisponible." : "Vous êtes disponible pour de nouvelles missions."));
}

export async function acceptMission(fd: FormData) {
  const { courier, m, o } = await myMission(s(fd, "mission_id"));
  if (m.status !== "proposed") redirect(msg(HOME, "error", "Mission déjà traitée."));
  if (o.courier_id && o.courier_id !== courier.id) {
    await createAdminClient().from("delivery_missions").update({ status: "cancelled" }).eq("id", m.id);
    redirect(msg(HOME, "error", "Cette livraison a déjà été prise par un autre livreur."));
  }
  if (["cancelled", "refused", "completed", "not_delivered"].includes(o.status)) redirect(msg(HOME, "error", "Commande annulée."));
  await createAdminClient().from("delivery_missions").update({ status: "accepted" }).eq("id", m.id);
  await assignCourierToOrder(o.id, courier.id, courier.network);
  await notifyRestaurantOwner(o.restaurant_id, { title: `Livreur affecté — ${o.code}`, body: courier.full_name, link: "/restaurant/commandes" });
  if (courier.network === "dinego") await notifyAdmins({ title: "Mission acceptée", body: `${courier.full_name} · ${o.code}`, link: "/admin/commandes" });
  await notify([courier.user_id], { title: "Livraison attribuée", body: `${o.code} vous est attribuée.`, link: HOME });
  redirect(msg(HOME, "ok", `Mission ${o.code} acceptée.`));
}

export async function refuseMission(fd: FormData) {
  const { m, o } = await myMission(s(fd, "mission_id"));
  if (m.status !== "proposed") redirect(msg(HOME, "error", "Mission déjà traitée."));
  const db = createAdminClient();
  await db.from("delivery_missions").update({ status: "refused", refuse_reason: s(fd, "reason") || null }).eq("id", m.id);
  const { count } = await db.from("delivery_missions").select("id", { count: "exact", head: true }).eq("order_id", o.id).eq("status", "proposed");
  if (!count && !o.courier_id) {
    await notifyRestaurantOwner(o.restaurant_id, { title: `Mission refusée — ${o.code}`, body: "Affectez un autre livreur.", link: "/restaurant/commandes" });
    await notifyAdmins({ title: "Mission sans livreur", body: o.code, link: "/admin/commandes" });
  }
  redirect(msg(HOME, "ok", "Mission refusée."));
}

/** Étapes de livraison : récupération, arrivée, remise au client (§6.3). */
export async function missionStep(fd: FormData) {
  const { profile, courier, m, o } = await myMission(s(fd, "mission_id"));
  const step = s(fd, "step");
  const db = createAdminClient();
  if (o.courier_id !== courier.id) redirect(msg(HOME, "error", "Mission non attribuée."));
  if (step === "picked_up" && m.status === "accepted" && ["ready", "awaiting_pickup"].includes(o.status)) {
    await db.from("delivery_missions").update({ status: "picked_up" }).eq("id", m.id);
    await setOrderStatus(o.id, "delivering", profile.id, `Récupérée par ${courier.full_name}`);
  } else if (step === "arrived" && m.status === "picked_up") {
    await db.from("delivery_missions").update({ status: "arrived" }).eq("id", m.id);
    await notify([o.client_id], { title: `${o.code} — votre livreur est arrivé`, body: courier.full_name, link: `/compte/commandes/${o.id}` });
  } else if (step === "delivered" && ["picked_up", "arrived"].includes(m.status)) {
    await db.from("delivery_missions").update({ status: "delivered" }).eq("id", m.id);
    await setOrderStatus(o.id, "handed_over", profile.id, `Remise par ${courier.full_name}`);
    await notify([courier.user_id], {
      title: "Confirmation de livraison",
      body: o.payment_method === "cash" ? "Pensez à confirmer l'encaissement en espèces." : `${o.code} livrée.`,
      link: HOME,
    });
    await completeIfSettled(o.id, profile.id);
  } else if (step === "picked_up") {
    redirect(msg(HOME, "error", "La commande n'est pas encore prête au restaurant."));
  } else redirect(msg(HOME, "error", "Étape non disponible."));
  redirect(msg(HOME, "ok", "Statut mis à jour."));
}

export async function courierConfirmCash(fd: FormData) {
  const { profile, o } = await myMission(s(fd, "mission_id"));
  if (!["delivering", "handed_over"].includes(o.status)) redirect(msg(HOME, "error", "Confirmez l'encaissement au moment de la remise."));
  const res = await confirmCashReceipt(o.id, profile, Math.round(Number(s(fd, "amount"))), s(fd, "reference") || null);
  redirect(msg(HOME, res.error ? "error" : "ok", res.error ?? "Encaissement confirmé."));
}

export async function courierIncident(fd: FormData) {
  const { profile, o } = await myMission(s(fd, "mission_id"));
  const reason = s(fd, "reason");
  const type = s(fd, "type") === "non_livree" ? "non_livree" : "autre";
  if (!reason) redirect(msg(HOME, "error", "Décrivez l'incident."));
  await createAdminClient().from("incidents").insert({ order_id: o.id, reported_by: profile.id, type, reason });
  if (type === "non_livree") {
    await setOrderStatus(o.id, "not_delivered", profile.id, reason);
    await createAdminClient().from("delivery_missions").update({ status: "cancelled" }).eq("id", s(fd, "mission_id"));
  }
  await notifyAdmins({ title: "Incident de livraison", body: `${o.code} : ${reason}`, link: "/admin/reclamations" });
  await notifyRestaurantOwner(o.restaurant_id, { title: `Incident signalé — ${o.code}`, body: reason, link: "/restaurant/commandes" });
  redirect(msg(HOME, "ok", "Incident signalé."));
}
