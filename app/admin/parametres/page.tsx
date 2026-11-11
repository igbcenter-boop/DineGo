import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { saveCategory, saveFeeSettings, savePlatformSettings, saveZone, toggleCategory, toggleZone } from "@/app/actions/admin";
import { computeBreakdown, type FeeSetting } from "@/lib/finance";
import { dateTime, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Paramètres — administration" };

export default async function AdminSettings(props: PageProps<"/admin/parametres">) {
  await requireRole("admin");
  const db = createAdminClient();
  const [{ data: fees }, { data: settings }, { data: categories }, { data: zones }] = await Promise.all([
    db.from("fee_settings").select("*, profiles(full_name)").order("created_at", { ascending: false }),
    db.from("platform_settings").select("key, value"),
    db.from("categories").select("*").order("sort"),
    db.from("zones").select("*").order("city").order("name"),
  ]);
  const current = fees?.[0] as (FeeSetting & { created_at: string }) | undefined;
  const setting = (k: string) => settings?.find((x) => x.key === k)?.value;
  const channels = (setting("notification_channels") ?? {}) as { sms?: boolean; email?: boolean };
  const example = current ? computeBreakdown({ subtotal: 4500, discount: 0, mode: "delivery", fee: current }) : null;

  return (
    <div className="container-dg mt-8 space-y-10">
      <h1 className="h1">Paramètres généraux</h1>
      <Flash searchParams={props.searchParams} />

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form action={saveFeeSettings} className="card space-y-4">
          <p className="h2">Commissions et frais</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Num label="Commission DineGo (% du montant des produits)" name="commission_percent" v={current?.commission_percent ?? 10} step="0.5" />
            <Num label="Frais de gestion fixes payés par le client (FCFA)" name="management_fee" v={current?.management_fee ?? 0} />
            <Num label="Frais de livraison par défaut (FCFA)" name="delivery_fee" v={current?.delivery_fee ?? 500} />
            <Num label="Part des frais de livraison versée au livreur (%)" name="courier_share_percent" v={current?.courier_share_percent ?? 100} step="1" />
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-violet">Règles particulières par zone (frais de livraison)</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {zones?.map((z) => (
                <label key={z.id} className="text-xs">
                  {z.name} ({z.city})
                  <input name={`zone_fee_${z.id}`} type="number" min={0} defaultValue={current?.zone_rules?.[z.id]?.delivery_fee ?? ""} placeholder="défaut" className="input py-1.5" />
                </label>
              ))}
            </div>
          </details>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-violet">Règles particulières par catégorie (commission %)</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {categories?.map((c) => (
                <label key={c.id} className="text-xs">
                  {c.name}
                  <input name={`cat_pct_${c.id}`} type="number" min={0} max={100} step="0.5" defaultValue={current?.category_rules?.[c.id]?.commission_percent ?? ""} placeholder="défaut" className="input py-1.5" />
                </label>
              ))}
            </div>
          </details>
          <input name="note" placeholder="Note sur ce changement (facultatif)" aria-label="Note" className="input" />
          <SubmitButton>Enregistrer une nouvelle version</SubmitButton>
          <p className="text-xs text-muted">Chaque modification crée une version datée. Les commandes déjà confirmées conservent leur ventilation.</p>
        </form>
        <div className="space-y-4">
          {example && (
            <div className="card text-sm">
              <p className="h3 mb-2">Exemple de ventilation</p>
              <p className="text-xs text-muted">Produits 4 500 FCFA + livraison :</p>
              <ul className="mt-2 space-y-1">
                <li className="flex justify-between"><span>Total client</span><strong>{fcfa(example.total)}</strong></li>
                <li className="flex justify-between"><span>Restaurant</span><span>{fcfa(example.restaurantShare)}</span></li>
                <li className="flex justify-between"><span>Livreur</span><span>{fcfa(example.courierShare)}</span></li>
                <li className="flex justify-between"><span>DineGo</span><span>{fcfa(example.dinegoShare)}</span></li>
              </ul>
            </div>
          )}
          <div className="card text-xs">
            <p className="h3 mb-2">Historique</p>
            <ul className="space-y-1">
              {fees?.map((f) => (
                <li key={f.id}>
                  {dateTime(f.created_at)} — {f.commission_percent} % · livraison {fcfa(f.delivery_fee)} · gestion {fcfa(f.management_fee)} · livreur {f.courier_share_percent} %
                  {f.note ? ` · ${f.note}` : ""} {f.profiles ? `(${(f.profiles as unknown as { full_name: string }).full_name})` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <form id="regles" action={savePlatformSettings} className="card scroll-mt-20 space-y-4">
        <p className="h2">Règles de fonctionnement</p>
        <fieldset className="space-y-1 text-sm">
          <legend className="label">Rémunération des livreurs du réseau DineGo quand le restaurant encaisse (§25.3)</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="network_courier_payment_circuit" value="via_dinego" defaultChecked={setting("network_courier_payment_circuit") !== "direct_restaurant"} />
            Le restaurant reverse la part du livreur à DineGo, qui règle le livreur
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="network_courier_payment_circuit" value="direct_restaurant" defaultChecked={setting("network_courier_payment_circuit") === "direct_restaurant"} />
            Le restaurant paie directement le livreur
          </label>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Num label="Délai de reversement quotidien (jours après la période)" name="remittance_daily_delay_days" v={Number(setting("remittance_daily_delay_days") ?? 1)} />
          <Num label="Délai de reversement hebdomadaire (jours après la semaine)" name="remittance_weekly_delay_days" v={Number(setting("remittance_weekly_delay_days") ?? 3)} />
        </div>
        <div>
          <label className="label" htmlFor="cancellation_rules">Règles d&apos;annulation (affichées aux clients)</label>
          <textarea id="cancellation_rules" name="cancellation_rules" rows={2} defaultValue={String(setting("cancellation_rules") ?? "")} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="refund_rules">Règles de remboursement</label>
          <textarea id="refund_rules" name="refund_rules" rows={2} defaultValue={String(setting("refund_rules") ?? "")} className="input" />
        </div>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="label">Canaux de notification</legend>
          <label className="flex items-center gap-2"><input type="checkbox" checked disabled /> Plateforme</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="sms" defaultChecked={channels.sms} /> SMS (prestataire à brancher)</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="email" defaultChecked={channels.email} /> E-mail (prestataire à brancher)</label>
        </fieldset>
        <SubmitButton>Enregistrer</SubmitButton>
      </form>

      <section id="categories" className="scroll-mt-20 grid gap-6 lg:grid-cols-2">
        <div className="card space-y-3">
          <p className="h2">Catégories</p>
          <ul className="space-y-1 text-sm">
            {categories?.map((c) => (
              <li key={c.id} className={`flex items-center justify-between gap-2 ${c.active ? "" : "opacity-50"}`}>
                <form action={saveCategory} className="flex flex-1 gap-1">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="icon" defaultValue={c.icon} aria-label="Icône" className="input w-14 py-1" />
                  <input name="name" defaultValue={c.name} aria-label="Nom" className="input py-1" />
                  <input name="sort" type="number" defaultValue={c.sort} aria-label="Ordre" className="input w-16 py-1" />
                  <SubmitButton className="btn-ghost btn-sm">✓</SubmitButton>
                </form>
                <form action={toggleCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton className="btn-outline btn-sm">{c.active ? "Masquer" : "Afficher"}</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
          <form action={saveCategory} className="flex gap-2">
            <input name="icon" placeholder="🍽️" aria-label="Icône" className="input w-16" />
            <input name="name" required placeholder="Nouvelle catégorie" aria-label="Nouvelle catégorie" className="input" />
            <SubmitButton className="btn-primary btn-sm">Ajouter</SubmitButton>
          </form>
        </div>
        <div id="zones" className="card scroll-mt-20 space-y-3">
          <p className="h2">Zones couvertes</p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {zones?.map((z) => (
              <li key={z.id} className={`flex items-center justify-between gap-2 ${z.active ? "" : "opacity-50"}`}>
                {z.name} <span className="text-xs text-muted">({z.city})</span>
                <form action={toggleZone}>
                  <input type="hidden" name="id" value={z.id} />
                  <SubmitButton className="btn-ghost btn-sm">{z.active ? "Désactiver" : "Activer"}</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
          <form action={saveZone} className="flex gap-2">
            <input name="city" required placeholder="Ville" aria-label="Ville" className="input" />
            <input name="name" required placeholder="Quartier / zone" aria-label="Zone" className="input" />
            <SubmitButton className="btn-primary btn-sm">Ajouter</SubmitButton>
          </form>
        </div>
      </section>
    </div>
  );
}

function Num({ label, name, v, step = "1" }: { label: string; name: string; v: number; step?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type="number" min={0} step={step} defaultValue={v} required className="input" />
    </div>
  );
}
