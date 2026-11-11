import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { adminUpdateRestaurant, setRestaurantStatus, toggleFeatured } from "@/app/actions/admin";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Restaurants — administration" };

const LABEL: Record<string, string> = { pending: "En attente", active: "Actif", suspended: "Suspendu", rejected: "Refusé" };

export default async function AdminRestaurants(props: PageProps<"/admin/restaurants">) {
  await requireRole("admin");
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const db = createAdminClient();
  let q = db.from("restaurants").select("*, categories(name), zones(name, city), profiles!restaurants_owner_id_fkey(email)").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const [{ data: list }, { data: categories }, { data: zones }, { data: orders }] = await Promise.all([
    q,
    db.from("categories").select("id, name").order("sort"),
    db.from("zones").select("id, city, name").order("city"),
    db.from("orders").select("restaurant_id, total, status"),
  ]);
  const activity = (id: string) => {
    const os = (orders ?? []).filter((o) => o.restaurant_id === id);
    return `${os.length} commande(s) · ${os.filter((o) => o.status === "completed").length} terminée(s)`;
  };
  return (
    <div className="container-dg mt-8 space-y-4">
      <h1 className="h1">Restaurants</h1>
      <Flash searchParams={props.searchParams} />
      <div className="flex flex-wrap gap-1">
        {["", "pending", "active", "suspended", "rejected"].map((st) => (
          <Link key={st} href={st ? `/admin/restaurants?status=${st}` : "/admin/restaurants"} className={status === st ? "btn-violet btn-sm" : "btn-ghost btn-sm"}>
            {st ? LABEL[st] : "Tous"}
          </Link>
        ))}
      </div>
      {!list?.length && <Empty>Aucun restaurant.</Empty>}
      <ul className="space-y-3">
        {list?.map((r) => (
          <li key={r.id} className="card space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-extrabold text-violet">
                  {r.name} {r.featured && <span className="chip ml-1">Mis en avant</span>}
                </p>
                <p className="text-xs text-muted">
                  {(r.categories as unknown as { name: string } | null)?.name} · {r.address}, {r.city} · {r.manager_name} · {r.phone} ·{" "}
                  {(r.profiles as unknown as { email: string } | null)?.email} · inscrit le {dateTime(r.created_at)}
                </p>
                <p className="text-xs text-muted">
                  Encaissement : {r.collection_mode === "dinego" ? "DineGo" : "restaurant"} ({r.remittance_frequency === "daily" ? "quotidien" : "hebdomadaire"}) · {activity(r.id)}
                  {r.financial_info ? ` · Infos financières : ${r.financial_info}` : ""}
                </p>
              </div>
              <StatusBadge status={r.status} label={LABEL[r.status]} />
            </div>
            {r.description && <p className="text-sm">{r.description}</p>}
            <div className="flex flex-wrap gap-2">
              {r.status !== "active" && <StatusForm id={r.id} status="active" label={r.status === "pending" ? "Valider et mettre en ligne" : "Activer"} primary />}
              {r.status === "pending" && <StatusForm id={r.id} status="rejected" label="Refuser" withReason />}
              {r.status === "active" && <StatusForm id={r.id} status="suspended" label="Suspendre" withReason />}
              <form action={toggleFeatured}>
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton className="btn-ghost btn-sm">{r.featured ? "Retirer de la une" : "Mettre en avant"}</SubmitButton>
              </form>
              <Link href={`/restaurants/${r.slug}`} className="btn-ghost btn-sm">Voir la page</Link>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-violet">Modifier les informations</summary>
              <form action={adminUpdateRestaurant} className="mt-3 grid gap-2 sm:grid-cols-3">
                <input type="hidden" name="id" value={r.id} />
                <input name="name" defaultValue={r.name} aria-label="Nom" className="input" />
                <input name="phone" defaultValue={r.phone} aria-label="Téléphone" className="input" />
                <input name="city" defaultValue={r.city} aria-label="Ville" className="input" />
                <input name="address" defaultValue={r.address} aria-label="Adresse" className="input sm:col-span-3" />
                <select name="category_id" defaultValue={r.category_id ?? ""} aria-label="Catégorie" className="input">
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select name="zone_id" defaultValue={r.zone_id ?? ""} aria-label="Zone" className="input">
                  <option value="">—</option>
                  {zones?.map((z) => <option key={z.id} value={z.id}>{z.name} ({z.city})</option>)}
                </select>
                <SubmitButton className="btn-primary btn-sm">Enregistrer</SubmitButton>
              </form>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusForm({ id, status, label, primary, withReason }: { id: string; status: string; label: string; primary?: boolean; withReason?: boolean }) {
  return (
    <form action={setRestaurantStatus} className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      {withReason && <input name="reason" placeholder="Motif" aria-label="Motif" className="input w-40 py-1.5" />}
      <SubmitButton className={primary ? "btn-primary btn-sm" : "btn-outline btn-sm"}>{label}</SubmitButton>
    </form>
  );
}
