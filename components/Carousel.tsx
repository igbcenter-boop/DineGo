"use client";

import { Children, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Carrousel de l'accueil : défilement automatique, pause au survol, transition en fondu. */
export function Carousel({ children, interval = 8000 }: { children: ReactNode; interval?: number }) {
  const slides = Children.toArray(children);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), interval);
    return () => clearInterval(t);
  }, [paused, n, interval]);

  return (
    <div
      className="relative"
      aria-roledescription="carrousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="grid">
        {slides.map((s, k) => (
          <div
            key={k}
            aria-roledescription="diapositive"
            aria-label={`${k + 1} sur ${n}`}
            aria-hidden={k !== i}
            inert={k !== i}
            className={`col-start-1 row-start-1 transition-all duration-700 ease-out ${k === i ? "opacity-100" : "pointer-events-none scale-[0.985] opacity-0"}`}
          >
            {s}
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={() => setI((i - 1 + n) % n)} className="btn-icon size-9 bg-white text-violet shadow-sm ring-1 ring-line" aria-label="Visuel précédent">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          {slides.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              aria-label={`Afficher le visuel ${k + 1}`}
              aria-current={k === i}
              className={`h-2.5 rounded-full transition-all duration-300 ${k === i ? "w-8 bg-orange" : "w-2.5 bg-lilac-300 hover:bg-violet-300"}`}
            />
          ))}
          <button onClick={() => setI((i + 1) % n)} className="btn-icon size-9 bg-white text-violet shadow-sm ring-1 ring-line" aria-label="Visuel suivant">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
