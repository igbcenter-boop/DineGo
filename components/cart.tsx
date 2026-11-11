"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartOption = { name: string; price: number };
export type CartItem = {
  key: string;
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  options: CartOption[];
};
export type Cart = {
  restaurant: { id: string; name: string; slug: string } | null;
  items: CartItem[];
};

const EMPTY: Cart = { restaurant: null, items: [] };
const KEY = "dinego_cart_v1";

type Ctx = {
  cart: Cart;
  ready: boolean;
  count: number;
  subtotal: number;
  add: (restaurant: NonNullable<Cart["restaurant"]>, item: Omit<CartItem, "key">, replace?: boolean) => "added" | "conflict";
  replaceWith: (restaurant: NonNullable<Cart["restaurant"]>, items: Omit<CartItem, "key">[]) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<Ctx | null>(null);

function itemKey(i: Omit<CartItem, "key">) {
  return i.product_id + "|" + i.options.map((o) => o.name).sort().join(",");
}

export function lineTotal(i: { unit_price: number; quantity: number; options: CartOption[] }) {
  return (i.unit_price + i.options.reduce((s, o) => s + o.price, 0)) * i.quantity;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du stockage local au montage
      if (raw) setCart(JSON.parse(raw));
    } catch {
      /* stockage indisponible : panier vide */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: Cart) => {
    setCart(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const count = cart.items.reduce((s, i) => s + i.quantity, 0);
    const subtotal = cart.items.reduce((s, i) => s + lineTotal(i), 0);
    return {
      cart,
      ready,
      count,
      subtotal,
      add(restaurant, item, replace) {
        if (replace) {
          persist({ restaurant, items: [{ ...item, key: itemKey(item) }] });
          return "added";
        }
        if (cart.restaurant && cart.restaurant.id !== restaurant.id && cart.items.length) return "conflict";
        const key = itemKey(item);
        const existing = cart.items.find((i) => i.key === key);
        const items = existing
          ? cart.items.map((i) => (i.key === key ? { ...i, quantity: i.quantity + item.quantity } : i))
          : [...cart.items, { ...item, key }];
        persist({ restaurant, items });
        return "added";
      },
      replaceWith(restaurant, items) {
        persist({ restaurant, items: items.map((i) => ({ ...i, key: itemKey(i) })) });
      },
      setQty(key, qty) {
        const items = qty <= 0 ? cart.items.filter((i) => i.key !== key) : cart.items.map((i) => (i.key === key ? { ...i, quantity: qty } : i));
        persist(items.length ? { ...cart, items } : EMPTY);
      },
      clear() {
        persist(EMPTY);
      },
    };
  }, [cart, ready, persist]);

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé dans CartProvider");
  return ctx;
}
