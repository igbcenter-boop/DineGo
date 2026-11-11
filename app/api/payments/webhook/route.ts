import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markPaymentConfirmed, markPaymentFailed } from "@/lib/orders";

/**
 * Point d'entrée pour la confirmation des paiements par un prestataire
 * (agrégateur Orange Money / Moov Money / carte) — §11.1.
 * Corps JSON : { order_code, status: "success" | "failed", provider_reference, amount }
 * En-tête  : x-dinego-signature = HMAC-SHA256(corps brut, PAYMENT_WEBHOOK_SECRET) en hexadécimal.
 * À adapter au format exact du prestataire retenu.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook non configuré" }, { status: 503 });
  const raw = await request.text();
  const given = Buffer.from(request.headers.get("x-dinego-signature") ?? "", "hex");
  const expected = createHmac("sha256", secret).update(raw).digest();
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "signature invalide" }, { status: 401 });
  }
  let body: { order_code?: string; status?: string; provider_reference?: string; amount?: number };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const { data: order } = await createAdminClient().from("orders").select("id, total").eq("code", String(body.order_code ?? "")).maybeSingle();
  if (!order) return NextResponse.json({ error: "commande inconnue" }, { status: 404 });
  if (body.status === "success") {
    if (Number(body.amount) !== order.total) {
      await markPaymentFailed(order.id, null);
      return NextResponse.json({ error: "montant incohérent" }, { status: 422 });
    }
    await markPaymentConfirmed(order.id, null, body.provider_reference ?? null);
  } else {
    await markPaymentFailed(order.id, null);
  }
  return NextResponse.json({ ok: true });
}
