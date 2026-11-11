"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { homeFor, type Role } from "@/lib/auth";
import { msg, slugify } from "@/lib/format";
import { notifyAdmins } from "@/lib/notify";
import { uploadImage } from "@/lib/storage";

function field(fd: FormData, name: string) {
  return String(fd.get(name) ?? "").trim();
}

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "";
}

export async function signIn(fd: FormData) {
  const email = field(fd, "email").toLowerCase();
  const password = field(fd, "password");
  const next = safeNext(field(fd, "next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect(msg(`/connexion${next ? `?next=${encodeURIComponent(next)}` : ""}`, "error", "E-mail ou mot de passe incorrect."));
  const { data: profile } = await createAdminClient().from("profiles").select("role, status").eq("id", data.user.id).single();
  if (profile?.status === "suspended") {
    await supabase.auth.signOut();
    redirect("/compte-suspendu");
  }
  redirect(next || homeFor((profile?.role ?? "client") as Role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Crée un compte confirmé côté serveur puis ouvre la session.
 * Le rôle est fixé par le serveur selon le parcours, jamais par le client.
 */
async function createAccount(fd: FormData, role: Exclude<Role, "admin">, errorPath: string) {
  const email = field(fd, "email").toLowerCase();
  const password = field(fd, "password");
  const full_name = field(fd, "full_name");
  const phone = field(fd, "phone");
  if (!full_name || !email || !phone) redirect(msg(errorPath, "error", "Nom, téléphone et e-mail sont obligatoires."));
  if (password.length < 8) redirect(msg(errorPath, "error", "Le mot de passe doit contenir au moins 8 caractères."));
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name, phone },
  });
  if (error || !data.user) {
    const already = error?.message?.toLowerCase().includes("already");
    redirect(msg(errorPath, "error", already ? "Un compte existe déjà avec cet e-mail. Connectez-vous." : "Inscription impossible : " + error?.message));
  }
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  return data.user.id;
}

export async function signUpClient(fd: FormData) {
  const next = safeNext(field(fd, "next"));
  await createAccount(fd, "client", `/inscription${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  redirect(next || "/compte");
}

/** Inscription d'un restaurant (§5.1) : compte + établissement en attente de validation. */
export async function registerRestaurant(fd: FormData) {
  const path = "/devenir-partenaire";
  const name = field(fd, "name");
  const address = field(fd, "address");
  const city = field(fd, "city");
  const manager = field(fd, "full_name");
  if (!name || !address || !city) redirect(msg(path, "error", "Nom commercial, adresse et ville sont obligatoires."));
  const userId = await createAccount(fd, "restaurant", path);
  const admin = createAdminClient();
  let logo: string | null = null;
  try {
    logo = await uploadImage(fd.get("logo"), "logos");
  } catch {
    logo = null;
  }
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await admin.from("restaurants").insert({
    owner_id: userId,
    name,
    slug,
    manager_name: manager,
    phone: field(fd, "phone"),
    email: field(fd, "email").toLowerCase(),
    address,
    city,
    zone_id: field(fd, "zone_id") || null,
    category_id: field(fd, "category_id") || null,
    cuisine_type: field(fd, "cuisine_type") || null,
    description: field(fd, "description") || null,
    opening_hours: field(fd, "opening_hours") || null,
    opens_at: field(fd, "opens_at") || null,
    closes_at: field(fd, "closes_at") || null,
    financial_info: field(fd, "financial_info") || null,
    logo_url: logo,
    status: "pending",
  });
  if (error) redirect(msg(path, "error", "Établissement non enregistré : " + error.message));
  await notifyAdmins({ title: "Nouvelle inscription restaurant", body: `${name} (${city}) attend une validation.`, link: "/admin/restaurants" });
  redirect(msg("/restaurant", "ok", "Inscription reçue ! Votre établissement sera visible après validation par DineGo. Vous pouvez déjà préparer votre menu."));
}

/** Inscription d'un livreur du réseau central DineGo (§3.4). */
export async function registerCourier(fd: FormData) {
  const path = "/devenir-livreur";
  const userId = await createAccount(fd, "livreur", path);
  const { error } = await createAdminClient().from("couriers").insert({
    user_id: userId,
    network: "dinego",
    full_name: field(fd, "full_name"),
    phone: field(fd, "phone"),
    zone_id: field(fd, "zone_id") || null,
    vehicle: field(fd, "vehicle") || null,
    id_document: field(fd, "id_document") || null,
    status: "pending",
  });
  if (error) redirect(msg(path, "error", "Profil livreur non enregistré : " + error.message));
  await notifyAdmins({ title: "Nouvelle inscription livreur", body: field(fd, "full_name"), link: "/admin/livreurs" });
  redirect(msg("/livreur", "ok", "Profil créé ! Il sera activé après validation par DineGo."));
}
