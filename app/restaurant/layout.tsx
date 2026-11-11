import { SpaceNav } from "@/components/SpaceNav";

export default function RestaurantLayout({ children }: LayoutProps<"/restaurant">) {
  return (
    <>
      <SpaceNav
        title="Espace restaurant"
        items={[
          { href: "/restaurant", label: "Tableau de bord" },
          { href: "/restaurant/commandes", label: "Commandes" },
          { href: "/restaurant/menu", label: "Menu" },
          { href: "/restaurant/promotions", label: "Promotions" },
          { href: "/restaurant/livreurs", label: "Livreurs" },
          { href: "/restaurant/finances", label: "Finances" },
          { href: "/restaurant/reversements", label: "Reversements" },
          { href: "/restaurant/reservations", label: "Réservations" },
          { href: "/restaurant/parametres", label: "Paramètres" },
        ]}
      />
      {children}
    </>
  );
}
