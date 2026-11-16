"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

/** Notification éphémère en haut de l'écran ; les erreurs restent jusqu'à fermeture. */
export function Toast({ kind, message }: { kind: "ok" | "error"; message: string }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (kind === "error") return;
    const t = setTimeout(() => setOpen(false), 4500);
    return () => clearTimeout(t);
  }, [kind, message]);
  if (!open) return null;
  const error = kind === "error";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4">
      <div
        role={error ? "alert" : "status"}
        className={`pointer-events-auto flex max-w-lg items-start gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-[var(--shadow-lift)] ring-1 ${
          error ? "bg-white text-red-700 ring-red-200" : "animate-toast bg-violet-800 text-white ring-white/10"
        } ${error ? "animate-fade-up" : ""}`}
      >
        {error ? <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-5 shrink-0 text-orange" aria-hidden />}
        <span className="flex-1">{message}</span>
        <button onClick={() => setOpen(false)} className="-mr-1 rounded-full p-0.5 opacity-70 hover:opacity-100" aria-label="Fermer">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
