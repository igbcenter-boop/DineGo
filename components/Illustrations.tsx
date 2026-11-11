/* Illustrations vectorielles des bannières, aux couleurs de la charte (§27.2). */
const V = "#4B176D";
const O = "#FF8A24";
const W = "#FFFFFF";
const P = "#FFE0C2";

export type IllustrationName =
  | "shop"
  | "bag"
  | "tag"
  | "user"
  | "phone"
  | "growth"
  | "dashboard"
  | "scooter"
  | "map"
  | "shield"
  | "help"
  | "calendar"
  | "plate";

export function Illustration({ name, count }: { name: IllustrationName; count?: number }) {
  const common = { viewBox: "0 0 200 140", className: "h-full max-h-56 w-full", role: "img" as const, "aria-hidden": true };
  switch (name) {
    case "shop":
      return (
        <svg {...common}>
          <rect x="55" y="62" width="90" height="58" rx="6" fill={W} />
          <path d="M45 40h110l10 26H35z" fill={O} />
          <path d="M35 66q10 12 21 0q10 12 21 0q10 12 22 0q10 12 22 0q11 12 22 0q10 12 22 0" fill={W} stroke={O} strokeWidth="3" />
          <rect x="68" y="80" width="22" height="40" rx="3" fill="#6B3A8E" />
          <rect x="102" y="80" width="30" height="20" rx="3" fill={P} />
          <circle cx="150" cy="30" r="14" fill={O} />
          <circle cx="150" cy="30" r="5" fill={V} />
          <path d="M142 40l8 14 8-14z" fill={O} />
        </svg>
      );
    case "bag":
      return (
        <svg {...common}>
          <path d="M80 50v-12a20 20 0 0 1 40 0v12" fill="none" stroke={W} strokeWidth="8" />
          <rect x="62" y="48" width="76" height="72" rx="12" fill={O} />
          <rect x="88" y="72" width="24" height="24" rx="6" fill={V} />
          <path d="M96 78h4a6 6 0 0 1 0 12h-4z" fill="none" stroke={W} strokeWidth="2.5" />
          <circle cx="100" cy="84" r="2" fill={O} />
          {count !== undefined && (
            <>
              <circle cx="146" cy="44" r="14" fill={W} />
              <text x="146" y="49" textAnchor="middle" fontSize="15" fontWeight="800" fill={V}>
                {count}
              </text>
            </>
          )}
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <g transform="rotate(35 100 70)">
            <path d="M60 45h60l25 25-25 25H60z" fill={O} />
            <circle cx="72" cy="70" r="6" fill={V} />
            <text x="108" y="77" textAnchor="middle" fontSize="20" fontWeight="800" fill={V}>
              -20%
            </text>
          </g>
          <circle cx="40" cy="110" r="9" fill={W} />
          <circle cx="170" cy="22" r="6" fill={W} />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="100" cy="55" r="20" fill={O} />
          <path d="M62 120a38 38 0 0 1 76 0z" fill={O} />
          <rect x="128" y="22" width="34" height="24" rx="6" fill={W} />
          <path d="M136 31h18M136 38h10" stroke={V} strokeWidth="3" strokeLinecap="round" />
          <path d="M48 98l5 10 11 1-8 7 3 11-11-6-10 6 3-11-8-7 11-1z" fill={W} />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <rect x="72" y="15" width="56" height="110" rx="12" fill={W} />
          <rect x="90" y="22" width="20" height="4" rx="2" fill="#E6D6F1" />
          <path d="M88 64v-8a12 12 0 0 1 24 0v8" fill="none" stroke={O} strokeWidth="6" />
          <rect x="84" y="62" width="32" height="28" rx="6" fill={O} />
          <circle cx="100" cy="76" r="4" fill={V} />
          <rect x="84" y="102" width="32" height="9" rx="4.5" fill={V} />
        </svg>
      );
    case "growth":
      return (
        <svg {...common}>
          <rect x="35" y="60" width="70" height="60" rx="6" fill={W} />
          <path d="M28 46h84l6 16H22z" fill={O} />
          <rect x="45" y="78" width="16" height="42" rx="2" fill="#6B3A8E" />
          <rect x="70" y="76" width="22" height="14" rx="2" fill={P} />
          <rect x="125" y="92" width="10" height="28" rx="3" fill={W} />
          <rect x="143" y="76" width="10" height="44" rx="3" fill={O} />
          <rect x="161" y="58" width="10" height="62" rx="3" fill={W} />
          <path d="M118 60l20-16 14 10 26-28" fill="none" stroke={O} strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="35" y="15" width="130" height="110" rx="12" fill={W} />
          <rect x="47" y="27" width="46" height="22" rx="5" fill="#F3EAF9" />
          <text x="56" y="43" fontSize="12" fontWeight="800" fill={V}>12</text>
          <rect x="107" y="27" width="46" height="22" rx="5" fill={P} />
          <text x="113" y="43" fontSize="10" fontWeight="800" fill={V}>FCFA</text>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={50 + i * 18} y={110 - [20, 30, 40, 34, 50, 38][i]} width="11" height={[20, 30, 40, 34, 50, 38][i]} rx="2" fill={i % 2 ? O : V} />
          ))}
        </svg>
      );
    case "scooter":
      return (
        <svg {...common}>
          <circle cx="60" cy="100" r="18" fill="none" stroke={W} strokeWidth="8" />
          <circle cx="150" cy="100" r="18" fill="none" stroke={W} strokeWidth="8" />
          <path d="M60 100h40l20-35h20l10 35" fill="none" stroke={W} strokeWidth="9" strokeLinejoin="round" />
          <path d="M132 52h18" stroke={W} strokeWidth="7" strokeLinecap="round" />
          <rect x="68" y="40" width="40" height="36" rx="6" fill={O} />
          <rect x="78" y="48" width="20" height="20" rx="5" fill={V} />
          <path d="M85 53h3a5 5 0 0 1 0 10h-3z" fill="none" stroke={W} strokeWidth="2" />
          <path d="M20 55h20M26 66h14" stroke={O} strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <rect x="30" y="15" width="140" height="110" rx="12" fill="#ffffff22" />
          <path d="M30 70h140M80 15v110M125 15v110" stroke="#ffffff44" strokeWidth="2" />
          <path d="M62 92q40 4 52-14t32-40" fill="none" stroke={O} strokeWidth="4" strokeDasharray="2 7" strokeLinecap="round" />
          <path d="M62 105c-8-10-12-15-12-21a12 12 0 0 1 24 0c0 6-4 11-12 21z" fill={W} />
          <circle cx="62" cy="84" r="5" fill={O} />
          <path d="M150 45c-10-12-15-19-15-26a15 15 0 0 1 30 0c0 7-5 14-15 26z" fill={O} />
          <circle cx="150" cy="20" r="6" fill={V} />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M100 12l50 18v35c0 32-22 52-50 62-28-10-50-30-50-62V30z" fill={W} />
          <path d="M78 50h44M78 66h30M78 82h44" stroke={V} strokeWidth="8" strokeLinecap="round" />
          <path d="M78 66h30" stroke={O} strokeWidth="8" strokeLinecap="round" />
          <circle cx="152" cy="108" r="14" fill={O} />
          <circle cx="152" cy="108" r="6" fill={V} />
        </svg>
      );
    case "help":
      return (
        <svg {...common}>
          <path d="M40 25h120a10 10 0 0 1 10 10v56a10 10 0 0 1-10 10H80l-26 22v-22H40a10 10 0 0 1-10-10V35a10 10 0 0 1 10-10z" fill={W} />
          <text x="100" y="82" textAnchor="middle" fontSize="54" fontWeight="800" fill={O}>?</text>
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="120" y="20" width="54" height="50" rx="8" fill={W} />
          <rect x="120" y="20" width="54" height="13" rx="6" fill={O} />
          <text x="147" y="60" textAnchor="middle" fontSize="20" fontWeight="800" fill={V}>20</text>
          <ellipse cx="85" cy="88" rx="55" ry="14" fill={W} />
          <rect x="81" y="98" width="8" height="30" rx="3" fill={W} />
          <circle cx="68" cy="84" r="9" fill={O} />
          <circle cx="100" cy="84" r="7" fill={P} />
        </svg>
      );
    case "plate":
    default:
      return (
        <svg {...common}>
          <path d="M70 15h30a55 55 0 0 1 0 110H70z" fill="none" stroke={W} strokeWidth="18" strokeLinejoin="round" />
          <circle cx="98" cy="70" r="26" fill={O} />
          <circle cx="98" cy="70" r="14" fill="none" stroke={W} strokeWidth="5" />
        </svg>
      );
  }
}
