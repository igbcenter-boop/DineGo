import { SpaceNav } from "@/components/SpaceNav";

export default function CourierLayout({ children }: LayoutProps<"/livreur">) {
  return (
    <>
      <SpaceNav
        title="Espace livreur"
        items={[
          { href: "/livreur", label: "Missions" },
          { href: "/livreur/remunerations", label: "Rémunérations et encaissements" },
        ]}
      />
      {children}
    </>
  );
}
