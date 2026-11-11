import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/Banner";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import { CheckoutForm } from "@/components/CheckoutForm";
import { Flash } from "@/components/ui";

export const metadata: Metadata = { title: "Validation de la commande" };

export default async function CheckoutPage(props: PageProps<"/commande">) {
  // Le compte client est obligatoire au moment de la validation (§4.7)
  const profile = await requireRole("client", "/commande");
  const supabase = await createClient();
  const [{ data: addresses }, { data: zones }] = await Promise.all([
    supabase.from("addresses").select("*").order("created_at"),
    supabase.from("zones").select("id, city, name").order("city").order("name"),
  ]);
  return (
    <>
      <Banner
        tone="violet"
        crumbs={[{ label: "Panier", href: "/panier" }, { label: "Validation" }]}
        title="Encore un instant,"
        highlight="c'est presque servi."
        text="Confirmez votre adresse, le mode de remise et le paiement. Le montant total est affiché avant la confirmation."
        illustration="bag"
      >
        <CheckoutSteps current={2} />
      </Banner>
      <div className="container-dg mt-8">
        <Flash searchParams={props.searchParams} />
        <CheckoutForm addresses={addresses ?? []} zones={zones ?? []} defaultPhone={profile.phone ?? ""} />
      </div>
    </>
  );
}
