import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/Banner";
import { CartView } from "@/components/CartWidgets";
import { CheckoutSteps } from "@/components/CheckoutSteps";

export const metadata: Metadata = { title: "Panier" };

export default async function CartPage() {
  const supabase = await createClient();
  const { data: fee } = await supabase.from("public_fees").select("delivery_fee").maybeSingle();
  return (
    <>
      <Banner
        tone="violet"
        crumbs={[{ label: "Panier" }]}
        title="Votre panier est"
        highlight="presque prêt."
        text="Une commande = un restaurant. Vérifiez vos plats, choisissez livraison ou retrait, puis votre moyen de paiement."
        illustration="bag"
      >
        <CheckoutSteps current={1} />
      </Banner>
      <div className="container-dg mt-8">
        <CartView deliveryFee={fee?.delivery_fee ?? 0} />
      </div>
    </>
  );
}
