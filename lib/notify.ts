import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Note = { title: string; body?: string; link?: string };

/** Notification dans la plateforme (les canaux SMS / e-mail se brancheraient ici). */
export async function notify(userIds: (string | null | undefined)[], note: Note) {
  const ids = [...new Set(userIds.filter(Boolean))] as string[];
  if (!ids.length) return;
  await createAdminClient()
    .from("notifications")
    .insert(ids.map((user_id) => ({ user_id, title: note.title, body: note.body ?? null, link: note.link ?? null })));
}

export async function notifyAdmins(note: Note) {
  const { data } = await createAdminClient().from("profiles").select("id").eq("role", "admin").eq("status", "active");
  await notify((data ?? []).map((p) => p.id), note);
}

export async function notifyRestaurantOwner(restaurantId: string, note: Note) {
  const { data } = await createAdminClient().from("restaurants").select("owner_id").eq("id", restaurantId).single();
  if (data) await notify([data.owner_id], note);
}

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string, data?: unknown) {
  await createAdminClient()
    .from("audit_log")
    .insert({ actor_id: actorId, action, entity, entity_id: entityId ?? null, data: data ?? null });
}
