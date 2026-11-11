import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/Banner";
import { Empty } from "@/components/ui";
import { dateOnly, fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: promos } = await supabase
    .from("promotions")
    .select("*, products(name, price), restaurants!inner(name, slug, city, status)")
    .eq("active", true)
    .eq("restaurants.status", "active")
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("discount_percent", { ascending: false });

  return (
    <>
      <Banner
        tone="cream"
        crumbs={[{ label: "Promotions" }]}
        title="Les bons plans"
        highlight="du moment."
        text="Réductions, menus promotionnels et offres temporaires proposés par les restaurants partenaires."
        illustration="tag"
      >
        <a href="#offres" className="btn-primary">
          Voir toutes les offres
        </a>
      </Banner>
      <div id="offres" className="container-dg mt-8 scroll-mt-20">
        {promos?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {promos.map((p) => (
              <Link key={p.id} href={`/restaurants/${p.restaurants.slug}`} className="card space-y-2 transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="badge bg-orange text-base text-violet-700">-{p.discount_percent}%</span>
                  <span className="text-xs text-muted">{p.ends_at ? `Jusqu'au ${dateOnly(p.ends_at)}` : "Offre permanente"}</span>
                </div>
                <h2 className="h3">{p.title}</h2>
                <p className="text-sm text-muted">{p.restaurants.name} · {p.restaurants.city}</p>
                {p.description && <p className="text-sm">{p.description}</p>}
                {p.products && (
                  <p className="text-sm">
                    Sur : <strong>{p.products.name}</strong> ({fcfa(p.products.price)})
                  </p>
                )}
                <p className="rounded-lg bg-cream px-3 py-2 text-xs text-orange-700">
                  Conditions : {p.conditions}
                  {p.min_order > 0 ? ` · dès ${fcfa(p.min_order)} d'achat` : ""}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <Empty>Aucune promotion en cours pour le moment. Revenez bientôt !</Empty>
        )}
      </div>
    </>
  );
}
