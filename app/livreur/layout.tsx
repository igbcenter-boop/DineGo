import { SpaceShell } from "@/components/SpaceNav";

export default function CourierLayout({ children }: LayoutProps<"/livreur">) {
  return (
    <SpaceShell
      title="Espace livreur"
      items={[
        { href: "/livreur", label: "Missions", icon: "couriers" },
        { href: "/livreur/remunerations", label: "Rémunérations", icon: "wallet" },
      ]}
    >
      {children}
    </SpaceShell>
  );
}
