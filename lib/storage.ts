import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Envoie une image dans le bucket public « media » et renvoie son URL publique (ou null si aucun fichier). */
export async function uploadImage(file: FormDataEntryValue | null, folder: string): Promise<string | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (!ALLOWED.includes(file.type)) throw new Error("Format d'image non accepté (JPEG, PNG, WebP ou GIF).");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image trop lourde (5 Mo maximum).");
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const db = createAdminClient();
  const { error } = await db.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Échec de l'envoi de l'image : " + error.message);
  return db.storage.from("media").getPublicUrl(path).data.publicUrl;
}
