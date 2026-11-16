import { SpaceShell } from "@/components/SpaceNav";

export default function RestaurantLayout({ children }: LayoutProps<"/restaurant">) {
  return (
    <SpaceShell
      title="Espace restaurant"
      items={[
        { href: "/restaurant", label: "Tableau de bord", icon: "dashboard" },
        { href: "/restaurant/commandes", label: "Commandes", icon: "orders" },
        { href: "/restaurant/menu", label: "Menu", icon: "menu" },
        { href: "/restaurant/promotions", label: "Promotions", icon: "promo" },
        { href: "/restaurant/livreurs", label: "Livreurs", icon: "couriers" },
        { href: "/restaurant/finances", label: "Finances", icon: "finance" },
        { href: "/restaurant/reversements", label: "Reversements", icon: "settlements" },
        { href: "/restaurant/reservations", label: "Réservations", icon: "calendar" },
        { href: "/restaurant/parametres", label: "Paramètres", icon: "settings" },
      ]}
    >
      {children}
    </SpaceShell>
  );
}
