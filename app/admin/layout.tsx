import { SpaceNav } from "@/components/SpaceNav";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <SpaceNav
        title="Administration"
        items={[
          { href: "/admin", label: "Pilotage" },
          { href: "/admin/restaurants", label: "Restaurants" },
          { href: "/admin/livreurs", label: "Livreurs" },
          { href: "/admin/utilisateurs", label: "Utilisateurs" },
          { href: "/admin/commandes", label: "Commandes" },
          { href: "/admin/finances", label: "Finances" },
          { href: "/admin/encaissements", label: "Encaissements" },
          { href: "/admin/reclamations", label: "Réclamations" },
          { href: "/admin/parametres", label: "Paramètres" },
        ]}
      />
      {children}
    </>
  );
}
