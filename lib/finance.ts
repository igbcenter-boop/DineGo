/**
 * Calcul du montant d'une commande et de sa ventilation interne (§7).
 * Fonction pure : facile à tester et utilisée uniquement côté serveur.
 */
export type FeeSetting = {
  id: string;
  commission_percent: number;
  management_fee: number;
  delivery_fee: number;
  courier_share_percent: number;
  zone_rules: Record<string, { delivery_fee?: number }>;
  category_rules: Record<string, { commission_percent?: number }>;
};

export type Promotion = {
  id: string;
  product_id: string | null;
  discount_percent: number;
  min_order: number;
};

export type PricedLine = { product_id: string; line_total: number };

export function computeDiscount(lines: PricedLine[], promos: Promotion[]) {
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  let discount = 0;
  // Promotions sur produit : la meilleure s'applique à chaque ligne concernée
  for (const line of lines) {
    const best = Math.max(0, ...promos.filter((p) => p.product_id === line.product_id).map((p) => p.discount_percent));
    discount += Math.round((line.line_total * best) / 100);
  }
  // Promotion globale : meilleure offre éligible, appliquée au reste
  const global = promos
    .filter((p) => !p.product_id && subtotal >= p.min_order)
    .sort((a, b) => b.discount_percent - a.discount_percent)[0];
  if (global) discount += Math.round(((subtotal - discount) * global.discount_percent) / 100);
  return Math.min(discount, subtotal);
}

export function computeBreakdown(params: {
  subtotal: number;
  discount: number;
  mode: "delivery" | "pickup";
  fee: FeeSetting;
  zoneId?: string | null;
  categoryId?: string | null;
}) {
  const { subtotal, discount, mode, fee, zoneId, categoryId } = params;
  const productsNet = Math.max(0, subtotal - discount);
  const zoneFee = zoneId ? fee.zone_rules?.[zoneId]?.delivery_fee : undefined;
  const deliveryFee = mode === "delivery" ? Number(zoneFee ?? fee.delivery_fee) : 0;
  const managementFee = Number(fee.management_fee);
  const commissionPercent = Number(
    (categoryId ? fee.category_rules?.[categoryId]?.commission_percent : undefined) ?? fee.commission_percent,
  );
  const total = productsNet + deliveryFee + managementFee;
  const commission = Math.round((productsNet * commissionPercent) / 100);
  const restaurantShare = productsNet - commission;
  const courierShare = mode === "delivery" ? Math.round((deliveryFee * Number(fee.courier_share_percent)) / 100) : 0;
  const dinegoShare = total - restaurantShare - courierShare;
  return { productsNet, deliveryFee, managementFee, total, commissionPercent, restaurantShare, courierShare, dinegoShare };
}

/**
 * Montant d'une commande dû dans un reversement.
 * - Encaissée par le restaurant : il doit à DineGo sa part (+ la part du livreur
 *   du réseau DineGo si le circuit retenu est « via DineGo »).
 * - Encaissée par DineGo : DineGo doit au restaurant sa part (+ la part de son
 *   livreur propre, que le restaurant rémunère).
 */
export function settlementAmount(f: {
  collector: string;
  restaurant_share: number;
  courier_share: number;
  dinego_share: number;
  courier_network: string | null;
}, networkCircuit: "via_dinego" | "direct_restaurant") {
  if (f.collector === "restaurant") {
    const courierViaDinego = f.courier_network === "dinego" && networkCircuit === "via_dinego";
    return { direction: "to_dinego" as const, amount: f.dinego_share + (courierViaDinego ? f.courier_share : 0) };
  }
  const restaurantCourier = f.courier_network === "restaurant";
  return { direction: "to_restaurant" as const, amount: f.restaurant_share + (restaurantCourier ? f.courier_share : 0) };
}

/** Période de regroupement (journée ou semaine lundi→dimanche) d'une date, en heure de Ouagadougou (UTC+0). */
export function periodFor(date: Date, frequency: "daily" | "weekly") {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (frequency === "daily") return { start: iso(d), end: iso(d) };
  const day = (d.getUTCDay() + 6) % 7; // lundi = 0
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - day);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: iso(start), end: iso(end) };
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
