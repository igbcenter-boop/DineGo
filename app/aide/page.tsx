import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/Banner";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { submitComplaint } from "@/app/actions/orders";
import { COMPLAINT_TYPES } from "@/lib/format";

export const metadata: Metadata = { title: "Aide et réclamations" };

export default async function HelpPage(props: PageProps<"/aide">) {
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("platform_settings").select("key, value").in("key", ["cancellation_rules", "refund_rules"]);
  const rule = (k: string) => String(settings?.find((s) => s.key === k)?.value ?? "");
  const { data: orders } =
    profile?.role === "client"
      ? await supabase.from("orders").select("id, code, created_at").eq("client_id", profile.id).order("created_at", { ascending: false }).limit(20)
      : { data: [] as { id: string; code: string }[] };

  const faq: [string, string][] = [
    ["Dois-je créer un compte pour consulter les restaurants ?", "Non. La consultation est libre ; un compte est demandé uniquement au moment de valider une commande."],
    ["Puis-je commander dans plusieurs restaurants à la fois ?", "Une commande concerne un seul restaurant. Pour plusieurs restaurants, passez plusieurs commandes indépendantes."],
    ["Quels moyens de paiement sont acceptés ?", "Orange Money, Moov Money, autres Mobile Money compatibles, carte bancaire lorsque disponible, et espèces à la livraison ou au retrait."],
    ["Comment annuler une commande ?", rule("cancellation_rules")],
    ["Comment se passe un remboursement ?", rule("refund_rules")],
    ["Comment suivre ma commande ?", "Depuis « Mon compte », chaque commande affiche son étape en cours. Vous êtes notifié à chaque changement."],
  ];

  return (
    <>
      <Banner
        tone="cream"
        crumbs={[{ label: "Aide" }]}
        title="Un souci avec"
        highlight="votre commande ?"
        text="Retard, produit manquant, problème de paiement : signalez-le, notre équipe vous répond."
        illustration="help"
      >
        <a href="#reclamation" className="btn-primary">Faire une réclamation</a>
        <a href="#faq" className="btn-outline">Questions fréquentes</a>
      </Banner>
      <div className="container-dg mt-8 grid gap-8 lg:grid-cols-2">
        <section id="reclamation" className="scroll-mt-20">
          <h2 className="h2 mb-3">Faire une réclamation</h2>
          <Flash searchParams={props.searchParams} />
          {profile ? (
            <form action={submitComplaint} className="card space-y-3">
              <input type="hidden" name="back" value="/aide" />
              {profile.role === "client" && (
                <div>
                  <label className="label" htmlFor="order_id">Commande concernée</label>
                  <select id="order_id" name="order_id" className="input">
                    <option value="">— Aucune / autre —</option>
                    {orders?.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label" htmlFor="type">Type de problème</label>
                <select id="type" name="type" className="input">
                  {Object.entries(COMPLAINT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="description">Description</label>
                <textarea id="description" name="description" required minLength={5} rows={4} className="input" />
              </div>
              <SubmitButton>Envoyer</SubmitButton>
            </form>
          ) : (
            <div className="card space-y-3 text-sm">
              <p>Connectez-vous pour déposer une réclamation et suivre sa réponse.</p>
              <a href="/connexion?next=/aide" className="btn-primary">Se connecter</a>
            </div>
          )}
        </section>
        <section id="faq" className="scroll-mt-20">
          <h2 className="h2 mb-3">Questions fréquentes</h2>
          <div className="space-y-2">
            {faq.map(([q, a]) => (
              <details key={q} className="card">
                <summary className="cursor-pointer font-bold text-violet">{q}</summary>
                <p className="mt-2 text-sm">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
