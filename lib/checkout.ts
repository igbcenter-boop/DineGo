import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeBreakdown, computeDiscount, type FeeSetting } from "@/lib/finance";
import { isOpenNow } from "@/lib/format";

export type CartInput = {
  restaurant_id: string;
  items: { product_id: string; quantity: number; options: { name: string }[] }[];
};

export type QuoteLine = {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  options: { name: string; price: number }[];
  line_total: number;
};

/**
 * Recalcule entièrement une commande à partir de la base :
 * le client ne fournit que des identifiants et des quantités, jamais de prix.
 */
export async function buildQuote(cart: CartInput, mode: "delivery" | "pickup", zoneId: string | null) {
  const db = createAdminClient();
  const errors: string[] = [];
  if (!cart?.restaurant_id || !Array.isArray(cart.items) || cart.items.length === 0) {
    return { ok: false as const, errors: ["Votre panier est vide."] };
  }
  const { data: restaurant } = await db
    .from("restaurants")
    .select("id, name, slug, status, owner_id, offers_delivery, offers_pickup, is_open, opens_at, closes_at, accepts_scheduled, zone_id, category_id, collection_mode")
    .eq("id", cart.restaurant_id)
    .single();
  if (!restaurant || restaurant.status !== "active") return { ok: false as const, errors: ["Ce restaurant n'est pas disponible."] };

  const ids = [...new Set(cart.items.map((i) => i.product_id))];
  const { data: products } = await db.from("products").select("id, restaurant_id, name, price, available, options").in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const lines: QuoteLine[] = [];
  for (const item of cart.items) {
    const p = byId.get(item.product_id);
    const qty = Math.floor(Number(item.quantity));
    // Règle fondamentale : une commande = un seul restaurant (§4.6)
    if (!p || p.restaurant_id !== restaurant.id) {
      errors.push("Une commande ne peut concerner qu'un seul restaurant.");
      continue;
    }
    if (!p.available) {
      errors.push(`« ${p.name} » n'est plus disponible.`);
      continue;
    }
    if (!(qty > 0 && qty <= 99)) {
      errors.push(`Quantité invalide pour « ${p.name} ».`);
      continue;
    }
    const catalog: { name: string; price: number }[] = Array.isArray(p.options) ? p.options : [];
    const options = (item.options ?? [])
      .map((o) => catalog.find((c) => c.name === o.name))
      .filter(Boolean) as { name: string; price: number }[];
    const unit = p.price + options.reduce((s, o) => s + Number(o.price), 0);
    lines.push({ product_id: p.id, name: p.name, unit_price: p.price, quantity: qty, options, line_total: unit * qty });
  }

  if (mode === "delivery" && !restaurant.offers_delivery) errors.push("Ce restaurant ne propose pas la livraison.");
  if (mode === "pickup" && !restaurant.offers_pickup) errors.push("Ce restaurant ne propose pas le retrait sur place.");

  const now = new Date().toISOString();
  const { data: promos } = await db
    .from("promotions")
    .select("id, product_id, discount_percent, min_order")
    .eq("restaurant_id", restaurant.id)
    .eq("active", true)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`);
  const { data: fee } = await db.from("fee_settings").select("*").order("created_at", { ascending: false }).limit(1).single();

  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const discount = computeDiscount(lines, promos ?? []);
  const breakdown = computeBreakdown({
    subtotal,
    discount,
    mode,
    fee: fee as FeeSetting,
    zoneId: zoneId ?? restaurant.zone_id,
    categoryId: restaurant.category_id,
  });

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    restaurant,
    open: isOpenNow(restaurant),
    lines,
    subtotal,
    discount,
    fee,
    breakdown,
  };
}
