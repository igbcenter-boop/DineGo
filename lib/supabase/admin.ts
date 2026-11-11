import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé de service : contourne le RLS.
 * À n'utiliser que dans du code serveur, APRÈS avoir vérifié le rôle de l'utilisateur.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
