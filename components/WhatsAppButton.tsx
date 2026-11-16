"use client";

import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart";
import { isProSpace } from "@/components/AppShell";

const NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/[^\d]/g, "");

/** Bouton flottant vers le service client WhatsApp (affiché si NEXT_PUBLIC_WHATSAPP_NUMBER est défini). */
export function WhatsAppButton() {
  const path = usePathname();
  const { count } = useCart();
  if (!NUMBER || isProSpace(path)) return null;
  const raised = count > 0 && !["/panier", "/commande"].includes(path);
  return (
    <a
      href={`https://wa.me/${NUMBER}?text=${encodeURIComponent("Bonjour DineGo, j'ai besoin d'aide.")}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contacter DineGo sur WhatsApp"
      className={`fixed right-4 z-30 grid size-13 place-items-center rounded-full bg-[#25D366] text-white shadow-[var(--shadow-lift)] transition hover:scale-105 md:bottom-6 ${
        raised ? "bottom-[calc(9.5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
      }`}
    >
      <svg viewBox="0 0 32 32" className="size-7" fill="currentColor" aria-hidden>
        <path d="M16.04 3C9.4 3 4 8.36 4 14.97c0 2.11.56 4.17 1.62 5.99L4 29l8.27-1.6a12.1 12.1 0 0 0 3.77.6C22.68 28 28 22.64 28 16.03 28 9.4 22.68 3 16.04 3Zm0 22.83c-1.24 0-2.46-.2-3.62-.6l-.26-.09-4.9.95.98-4.73-.17-.28a9.6 9.6 0 0 1-1.48-5.11c0-5.4 4.4-9.8 9.45-9.8 5.33 0 9.67 4.4 9.67 9.86 0 5.42-4.34 9.8-9.67 9.8Zm5.3-7.34c-.29-.15-1.72-.85-1.99-.94-.27-.1-.46-.15-.66.14-.19.29-.75.94-.92 1.14-.17.19-.34.22-.63.07-.29-.14-1.22-.45-2.33-1.43-.86-.77-1.44-1.71-1.61-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.5.14-.17.19-.29.29-.48.1-.2.05-.37-.03-.51-.07-.15-.65-1.57-.9-2.15-.23-.56-.47-.49-.65-.5h-.55c-.2 0-.5.07-.77.36-.26.29-1 1-1 2.42 0 1.43 1.04 2.82 1.18 3.01.15.2 2.05 3.12 4.96 4.37.69.3 1.23.48 1.65.61.7.22 1.33.19 1.83.12.56-.09 1.72-.7 1.96-1.38.24-.67.24-1.25.17-1.37-.07-.12-.27-.2-.56-.34Z" />
      </svg>
    </a>
  );
}
