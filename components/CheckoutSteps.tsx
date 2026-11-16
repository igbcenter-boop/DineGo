const STEPS = ["Panier", "Adresse", "Livraison ou retrait", "Paiement", "Confirmation"];

export function CheckoutSteps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Étapes de la commande">
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i + 1 === current ? "step" : undefined}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${i + 1 === current ? "bg-orange text-violet-800 shadow-[var(--shadow-glow)]" : i + 1 < current ? "bg-white/25 text-white" : "bg-white/10 text-white/70"}`}
        >
          {i + 1}. {s}
        </li>
      ))}
    </ol>
  );
}
