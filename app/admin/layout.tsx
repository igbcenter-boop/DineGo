import { SpaceShell } from "@/components/SpaceNav";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <SpaceShell
      title="Administration"
      items={[
        { href: "/admin", label: "Pilotage", icon: "dashboard" },
        { href: "/admin/restaurants", label: "Restaurants", icon: "store" },
        { href: "/admin/livreurs", label: "Livreurs", icon: "couriers" },
        { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "users" },
        { href: "/admin/commandes", label: "Commandes", icon: "orders" },
        { href: "/admin/finances", label: "Finances", icon: "finance" },
        { href: "/admin/encaissements", label: "Encaissements", icon: "cash" },
        { href: "/admin/reclamations", label: "Réclamations", icon: "help" },
        { href: "/admin/parametres", label: "Paramètres", icon: "settings" },
      ]}
    >
      {children}
    </SpaceShell>
  );
}
