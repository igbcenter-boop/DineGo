const STEPS = ["Panier", "Adresse", "Livraison ou retrait", "Paiement", "Confirmation"];

export function CheckoutSteps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Étapes de la commande">
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i + 1 === current ? "step" : undefined}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${i + 1 === current ? "bg-orange text-violet-700" : "bg-white/15 text-white"}`}
        >
          {i + 1}. {s}
        </li>
      ))}
    </ol>
  );
}
