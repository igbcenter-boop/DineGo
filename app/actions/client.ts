"use server";

import { redirect } from "next/navigation";
import { requireRole, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { msg } from "@/lib/format";
import { notifyRestaurantOwner } from "@/lib/notify";

export async function addAddress(fd: FormData) {
  const profile = await requireRole("client");
  const details = String(fd.get("details") ?? "").trim();
  const city = String(fd.get("city") ?? "").trim();
  if (!details || !city) redirect(msg("/compte#adresses", "error", "Ville et adresse sont obligatoires."));
  const supabase = await createClient();
  await supabase.from("addresses").insert({
    user_id: profile.id,
    label: String(fd.get("label") ?? "").trim() || "Adresse",
    city,
    zone: String(fd.get("zone") ?? "").trim() || null,
    details,
    phone: String(fd.get("phone") ?? "").trim() || null,
  });
  redirect(msg("/compte", "ok", "Adresse enregistrée."));
}

export async function deleteAddress(fd: FormData) {
  await requireRole("client");
  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", String(fd.get("id")));
  redirect(msg("/compte", "ok", "Adresse supprimée."));
}

export async function updateMyProfile(fd: FormData) {
  const profile = await requireRole(["client", "restaurant", "livreur", "admin"]);
  await createAdminClient()
    .from("profiles")
    .update({ full_name: String(fd.get("full_name") ?? "").trim() || profile.full_name, phone: String(fd.get("phone") ?? "").trim() || null })
    .eq("id", profile.id);
  const back = String(fd.get("back") ?? "/compte");
  redirect(msg(back.startsWith("/") ? back : "/compte", "ok", "Coordonnées mises à jour."));
}

export async function markNotificationsRead() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion");
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("user_id", profile.id).eq("read", false);
  redirect("/notifications");
}

/** Demande de réservation de table (phase 4, §17.2). */
export async function requestReservation(fd: FormData) {
  const profile = await requireRole("client", "/reservation");
  const restaurantId = String(fd.get("restaurant_id") ?? "");
  const when = new Date(String(fd.get("reserved_for") ?? ""));
  const people = Number(fd.get("people"));
  const back = "/reservation";
  if (!restaurantId || isNaN(when.getTime()) || when.getTime() < Date.now()) redirect(msg(back, "error", "Choisissez un restaurant et une date future."));
  if (!(people >= 1 && people <= 50)) redirect(msg(back, "error", "Nombre de personnes invalide."));
  const db = createAdminClient();
  const { data: r } = await db.from("restaurants").select("id, name, accepts_reservations, status").eq("id", restaurantId).single();
  if (!r || !r.accepts_reservations || r.status !== "active") redirect(msg(back, "error", "Ce restaurant ne prend pas de réservations."));
  await db.from("reservations").insert({
    restaurant_id: restaurantId,
    client_id: profile.id,
    reserved_for: when.toISOString(),
    people,
    note: String(fd.get("note") ?? "").trim() || null,
  });
  await notifyRestaurantOwner(restaurantId, { title: "Nouvelle demande de réservation", body: `${people} pers. · ${when.toLocaleString("fr-FR")}`, link: "/restaurant/reservations" });
  redirect(msg("/compte#reservations", "ok", "Demande envoyée. Vous serez notifié de la confirmation."));
}
