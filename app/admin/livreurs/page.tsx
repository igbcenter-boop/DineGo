import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Empty, Flash, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { setCourierStatus } from "@/app/actions/admin";
import { fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Livreurs — administration" };

const LABEL: Record<string, string> = { pending: "En attente", active: "Actif", suspended: "Suspendu" };

export default async function AdminCouriers(props: PageProps<"/admin/livreurs">) {
  await requireRole("admin");
  const db = createAdminClient();
  const [{ data: couriers }, { data: zones }, { data: missions }, { data: earnings }] = await Promise.all([
    db.from("couriers").select("*, zones(name, city), restaurants(name)").order("created_at", { ascending: false }),
    db.from("zones").select("id, city, name").order("city"),
    db.from("delivery_missions").select("courier_id, status"),
    db.from("courier_earnings").select("courier_id, amount, status"),
  ]);
  const network = (couriers ?? []).filter((c) => c.network === "dinego");
  const own = (couriers ?? []).filter((c) => c.network === "restaurant");
  const stats = (id: string) => {
    const m = (missions ?? []).filter((x) => x.courier_id === id);
    const e = (earnings ?? []).filter((x) => x.courier_id === id);
    return `${m.filter((x) => x.status === "delivered").length} livrée(s) · ${m.filter((x) => ["accepted", "picked_up", "arrived"].includes(x.status)).length} en cours · gagné ${fcfa(e.reduce((a, x) => a + x.amount, 0))} (dû ${fcfa(e.filter((x) => x.status === "due").reduce((a, x) => a + x.amount, 0))})`;
  };
  return (
    <div className="container-dg mt-8 space-y-8">
      <h1 className="h1">Livreurs</h1>
      <Flash searchParams={props.searchParams} />
      <section className="space-y-2">
        <h2 className="h2">Réseau central DineGo</h2>
        {!network.length && <Empty>Aucun livreur du réseau.</Empty>}
        {network.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-violet">{c.full_name} <StatusBadge status={c.status} label={LABEL[c.status]} /></p>
              <p className="text-xs text-muted">
                {c.phone} · {(c.zones as unknown as { name: string; city: string } | null)?.name ?? "sans zone"} · {c.vehicle ?? "—"} · pièce : {c.id_document ?? "—"} · {c.available ? "disponible" : "indisponible"}
              </p>
              <p className="text-xs text-muted">{stats(c.id)}</p>
            </div>
            <form action={setCourierStatus} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={c.id} />
              <select name="zone_id" defaultValue={c.zone_id ?? ""} aria-label="Zone affectée" className="input w-44 py-1.5">
                {zones?.map((z) => <option key={z.id} value={z.id}>{z.name} ({z.city})</option>)}
              </select>
              <select name="status" defaultValue={c.status === "pending" ? "active" : c.status} aria-label="Statut" className="input w-36 py-1.5">
                <option value="active">Activer</option>
                <option value="suspended">Suspendre</option>
                <option value="pending">En attente</option>
              </select>
              <SubmitButton className="btn-primary btn-sm">{c.status === "pending" ? "Valider" : "Appliquer"}</SubmitButton>
            </form>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="h2">Livreurs propres aux restaurants</h2>
        {own.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="table-dg">
              <thead><tr><th>Livreur</th><th>Restaurant</th><th>Téléphone</th><th>Activité</th><th>Statut</th><th /></tr></thead>
              <tbody>
                {own.map((c) => (
                  <tr key={c.id}>
                    <td>{c.full_name}</td>
                    <td>{(c.restaurants as unknown as { name: string } | null)?.name}</td>
                    <td>{c.phone}</td>
                    <td className="text-xs">{stats(c.id)}</td>
                    <td><StatusBadge status={c.status} label={LABEL[c.status]} /></td>
                    <td>
                      <form action={setCourierStatus}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="status" value={c.status === "active" ? "suspended" : "active"} />
                        <SubmitButton className="btn-outline btn-sm">{c.status === "active" ? "Suspendre" : "Activer"}</SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun livreur propre.</Empty>
        )}
      </section>
    </div>
  );
}
