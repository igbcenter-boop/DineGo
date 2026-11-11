"use client";

import { Children, useEffect, useState, type ReactNode } from "react";

/** Carrousel de l'accueil : défilement automatique, pause au survol, navigation par points. */
export function Carousel({ children, interval = 8000 }: { children: ReactNode; interval?: number }) {
  const slides = Children.toArray(children);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [paused, slides.length, interval]);

  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)}>
      {slides.map((s, k) => (
        <div key={k} hidden={k !== i} aria-roledescription="diapositive" aria-label={`${k + 1} sur ${slides.length}`}>
          {s}
        </div>
      ))}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              aria-label={`Afficher le visuel ${k + 1}`}
              aria-current={k === i}
              className={`h-2.5 rounded-full transition-all ${k === i ? "w-8 bg-orange" : "w-2.5 bg-white/70 ring-1 ring-violet/30"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
