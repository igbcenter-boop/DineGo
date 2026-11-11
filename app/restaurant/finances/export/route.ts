import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { restaurantStatement } from "@/lib/statements";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/format";

/** Relevé des opérations du restaurant au format CSV (§12). */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.role !== "restaurant" || profile.status !== "active") {
    return new NextResponse("Accès refusé", { status: 403 });
  }
  const { data: restaurant } = await createAdminClient().from("restaurants").select("id, slug").eq("owner_id", profile.id).limit(1).maybeSingle();
  if (!restaurant) return new NextResponse("Aucun établissement", { status: 404 });
  const sp = request.nextUrl.searchParams;
  const rows = await restaurantStatement(restaurant.id, {
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    status: sp.get("status") ?? undefined,
    code: sp.get("code") ?? undefined,
  });
  const header = ["Commande", "Date", "Statut", "Mode", "Moyen de paiement", "Statut paiement", "Encaissé par", "Total", "Part restaurant", "Part livreur", "Part DineGo", "Remboursé"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.code,
      new Date(r.created_at).toISOString(),
      ORDER_STATUS[r.status],
      r.mode === "delivery" ? "Livraison" : "Retrait",
      PAYMENT_METHOD[r.payment_method],
      PAYMENT_STATUS[r.payment_status],
      r.fin?.collector === "restaurant" ? "Restaurant" : "DineGo",
      r.total,
      r.fin?.restaurant_share ?? "",
      r.fin?.courier_share ?? "",
      r.fin?.dinego_share ?? "",
      r.refunded,
    ]
      .map(esc)
      .join(";"),
  );
  const csv = "﻿" + [header.map(esc).join(";"), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="releve-${restaurant.slug}.csv"`,
    },
  });
}
