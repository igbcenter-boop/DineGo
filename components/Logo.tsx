import Link from "next/link";

/**
 * Logo officiel DineGo — « Monogramme D-assiette » (§26.8).
 * variant "color" : carré violet (fonds clairs) ; "white" : carré blanc (fonds violets ou sombres).
 */
export function LogoSymbol({ size = 40, variant = "color" }: { size?: number; variant?: "color" | "white" }) {
  const square = variant === "color" ? "#4B176D" : "#FFFFFF";
  const letter = variant === "color" ? "#FFFFFF" : "#4B176D";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="DineGo" className="shrink-0">
      <rect width="100" height="100" rx="24" fill={square} />
      <path d="M30 24h17a26 26 0 0 1 0 52H30z" fill="none" stroke={letter} strokeWidth="9" strokeLinejoin="round" />
      <circle cx="45" cy="50" r="11.5" fill="#FF8A24" />
      <circle cx="45" cy="50" r="6" fill="none" stroke="#FFFFFF" strokeWidth="3" />
    </svg>
  );
}

export function Wordmark({ onDark = false, className = "text-xl" }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className={onDark ? "text-white" : "text-violet"}>Dine</span>
      <span className="text-orange">Go</span>
    </span>
  );
}

/** Version horizontale : symbole à gauche du nom. */
export function LogoHorizontal({
  onDark = false,
  size = 36,
  slogan = false,
  href = "/",
  compact = false,
}: {
  onDark?: boolean;
  size?: number;
  slogan?: boolean;
  href?: string | null;
  /** Sur petit écran, n'affiche que le symbole (le nom reste lu par les lecteurs d'écran). */
  compact?: boolean;
}) {
  const inner = (
    <span className="inline-flex items-center gap-2.5">
      <LogoSymbol size={size} variant={onDark ? "white" : "color"} />
      <span className={`flex-col leading-none ${compact ? "hidden sm:flex" : "flex"}`}>
        <Wordmark onDark={onDark} className={size >= 48 ? "text-3xl" : "text-xl"} />
        {slogan && (
          <span className={`mt-1 text-[9px] font-semibold tracking-[0.2em] ${onDark ? "text-white/80" : "text-violet"}`}>
            CHOISISSEZ · COMMANDEZ · SAVOUREZ
          </span>
        )}
      </span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} aria-label="DineGo — accueil" className="inline-flex">
      {inner}
    </Link>
  );
}

/** Version verticale : symbole au-dessus du nom. */
export function LogoVertical({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="inline-flex flex-col items-center gap-2">
      <LogoSymbol size={72} variant={onDark ? "white" : "color"} />
      <Wordmark onDark={onDark} className="text-3xl" />
      <span className={`text-[10px] font-semibold tracking-[0.2em] ${onDark ? "text-white/80" : "text-violet"}`}>
        CHOISISSEZ · COMMANDEZ · SAVOUREZ
      </span>
    </span>
  );
}
