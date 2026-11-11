import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Role = "client" | "restaurant" | "livreur" | "admin";
export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: "active" | "suspended";
};

/** Profil de l'utilisateur connecté (ou null). Mis en cache pour la durée de la requête. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, role, full_name, phone, email, status")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile) ?? null;
});

/** Exige un compte actif ayant l'un des rôles donnés, sinon redirige. */
export async function requireRole(roles: Role[] | Role, next?: string): Promise<Profile> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const profile = await getProfile();
  if (!profile) redirect(`/connexion${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (profile.status === "suspended") redirect("/compte-suspendu");
  if (!allowed.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}

export function homeFor(role: Role) {
  switch (role) {
    case "restaurant":
      return "/restaurant";
    case "livreur":
      return "/livreur";
    case "admin":
      return "/admin";
    default:
      return "/compte";
  }
}

/** Restaurant appartenant à l'utilisateur restaurateur connecté. */
export async function requireMyRestaurant() {
  const profile = await requireRole("restaurant");
  const { data } = await createAdminClient()
    .from("restaurants")
    .select("*")
    .eq("owner_id", profile.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) redirect("/devenir-partenaire?error=" + encodeURIComponent("Aucun établissement lié à ce compte."));
  return { profile, restaurant: data };
}

/** Fiche livreur de l'utilisateur livreur connecté. */
export async function requireMyCourier() {
  const profile = await requireRole("livreur");
  const { data } = await createAdminClient().from("couriers").select("*, zones(city, name)").eq("user_id", profile.id).maybeSingle();
  return { profile, courier: data };
}
