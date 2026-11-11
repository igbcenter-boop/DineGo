import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type StatementFilters = { from?: string; to?: string; status?: string; code?: string };

/** Opérations d'un restaurant avec leur ventilation (§12), filtrables par période, commande et statut. */
export async function restaurantStatement(restaurantId: string, f: StatementFilters) {
  let q = createAdminClient()
    .from("orders")
    .select(
      "id, code, created_at, status, mode, payment_method, payment_status, total, delivery_fee, order_financials(collector, commission_percent, restaurant_share, courier_share, dinego_share, collected_amount, courier_network), refunds(amount, status)",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (f.from) q = q.gte("created_at", new Date(f.from + "T00:00:00Z").toISOString());
  if (f.to) q = q.lte("created_at", new Date(f.to + "T23:59:59Z").toISOString());
  if (f.status) q = q.eq("status", f.status);
  if (f.code) q = q.ilike("code", `%${f.code}%`);
  const { data } = await q;
  return (data ?? []).map((o) => {
    const fin = (Array.isArray(o.order_financials) ? o.order_financials[0] : o.order_financials) as {
      collector: string;
      commission_percent: number;
      restaurant_share: number;
      courier_share: number;
      dinego_share: number;
      collected_amount: number;
      courier_network: string | null;
    } | null;
    const refunds = (o.refunds ?? []) as { amount: number; status: string }[];
    return {
      ...o,
      fin,
      refunded: refunds.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0),
    };
  });
}
