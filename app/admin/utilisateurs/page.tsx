import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Flash, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { createAdminAccount, setUserStatus } from "@/app/actions/admin";
import { ROLE_LABEL, dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Utilisateurs — administration" };

export default async function AdminUsers(props: PageProps<"/admin/utilisateurs">) {
  const me = await requireRole("admin");
  const sp = await props.searchParams;
  const role = typeof sp.role === "string" ? sp.role : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  let query = createAdminClient().from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (role) query = query.eq("role", role);
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[%,()]/g, " ")}%,email.ilike.%${q.replace(/[%,()]/g, " ")}%,phone.ilike.%${q.replace(/[%,()]/g, " ")}%`);
  const { data: users } = await query;
  return (
    <div className="container-dg mt-8 space-y-4">
      <h1 className="h1">Utilisateurs</h1>
      <Flash searchParams={props.searchParams} />
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Nom, e-mail, téléphone" aria-label="Recherche" className="input w-64" />
        <select name="role" defaultValue={role} aria-label="Rôle" className="input w-44">
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-primary">Filtrer</button>
        <Link href="/admin/utilisateurs" className="btn-ghost">Effacer</Link>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table-dg">
          <thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>Rôle</th><th>Inscription</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold">{u.full_name || "—"}</td>
                <td>{u.email}</td>
                <td>{u.phone ?? "—"}</td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>{dateTime(u.created_at)}</td>
                <td><StatusBadge status={u.status} label={u.status === "active" ? "Actif" : "Suspendu"} /></td>
                <td>
                  {u.id !== me.id && (
                    <form action={setUserStatus}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="status" value={u.status === "active" ? "suspended" : "active"} />
                      <SubmitButton className="btn-outline btn-sm" confirm={u.status === "active" ? "Suspendre ce compte ?" : undefined}>{u.status === "active" ? "Suspendre" : "Réactiver"}</SubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={createAdminAccount} className="card grid max-w-3xl gap-3 sm:grid-cols-4">
        <p className="h3 sm:col-span-4">Créer un compte administrateur / responsable opérationnel</p>
        <input name="full_name" required placeholder="Nom" aria-label="Nom" className="input" />
        <input name="email" type="email" required placeholder="E-mail" aria-label="E-mail" className="input" />
        <input name="password" type="password" required minLength={10} placeholder="Mot de passe (10+)" aria-label="Mot de passe" className="input" />
        <SubmitButton>Créer</SubmitButton>
      </form>
    </div>
  );
}
