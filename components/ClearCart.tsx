"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart";

/** Vide le panier une fois la commande enregistrée. */
export function ClearCart() {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return null;
}
