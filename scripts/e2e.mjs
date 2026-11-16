// Test de bout en bout des parcours DineGo (tests de réception §23).
// Prérequis : serveur lancé (BASE_URL, défaut http://localhost:3100), données de scripts/seed.mjs.
// Usage : node scripts/e2e.mjs
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const creds = Object.fromEntries(
  readFileSync("credentials.local.txt", "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length === 3 && p[1].includes("@"))
    .map(([, email, password]) => [email, password]),
);

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    → ${String(e.message).split("\n")[0].slice(0, 300)}`);
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const browser = await chromium.launch({ channel: "msedge" });
async function session(email) {
  const ctx = await browser.newContext({ locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  if (email) await login(page, email);
  return page;
}
async function login(page, email, next = "") {
  await page.goto(`${BASE}/connexion${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.fill("#email", email);
  await page.fill("#password", creds[email]);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion")), page.click("form button[type=submit]:has-text('Se connecter')")]);
}
/** Ouvre une page propre, clique, puis attend le retour de l'action serveur (?ok= / ?error=). */
async function act(page, path, code, button, before) {
  await page.goto(BASE + path);
  const c = card(page, code);
  if (before) await before(c);
  await Promise.all([page.waitForURL(/[?&](ok|error)=/), c.getByRole("button", { name: button }).click()]);
  const f = await flash(page);
  if (page.url().includes("error=")) throw new Error(`« ${button} » : ${f}`);
  return f;
}
const card = (page, code) => page.locator("article, .card").filter({ hasText: code }).first();
async function flash(page) {
  return (await page.locator("[role=status], [role=alert]").first().textContent({ timeout: 5000 }).catch(() => "")) ?? "";
}

// Restaurants de test ouverts quelle que soit l'heure d'exécution
const { data: before } = await db.from("restaurants").select("slug, opens_at, closes_at, is_open").in("slug", ["le-maquis-du-faso", "grill-wend-kuuni"]);
await db.from("restaurants").update({ opens_at: null, closes_at: null, is_open: true }).in("slug", ["le-maquis-du-faso", "grill-wend-kuuni"]);
const cleanup = [];

try {
  console.log("\n▶ Espace public et client");
  const client = await session();
  await check("1-4. Consultation sans compte, recherche, menu", async () => {
    await client.goto(`${BASE}/restaurants?q=bissap`);
    await client.getByText("Le Maquis du Faso").first().waitFor({ timeout: 20000 });
    await client.goto(`${BASE}/restaurants/le-maquis-du-faso`);
    await client.getByRole("heading", { name: "Riz gras" }).waitFor({ timeout: 20000 });
  });
  await check("5. Ajout au panier avec option", async () => {
    const riz = client.locator("article").filter({ has: client.getByRole("heading", { name: "Riz gras" }) });
    await riz.getByRole("button", { name: "Ajouter Riz gras" }).click();
    const sheet = client.getByRole("dialog", { name: "Riz gras" });
    await sheet.getByLabel("Œuf").check();
    await sheet.getByRole("button", { name: /^Ajouter au panier/ }).click();
    const bissap = client.locator("article").filter({ has: client.getByRole("heading", { name: "Jus de bissap" }) });
    await bissap.getByRole("button", { name: "Ajouter Jus de bissap" }).click();
    await client.getByText("Ajouté au panier ✓").first().waitFor();
  });
  await check("6. Panier multi-restaurants empêché", async () => {
    await client.goto(`${BASE}/restaurants/grill-wend-kuuni`);
    const soupe = client.locator("article").filter({ has: client.getByRole("heading", { name: "Soupe de mouton" }) });
    await soupe.getByRole("button", { name: "Ajouter Soupe de mouton" }).click();
    await client.getByText("Une commande ne peut concerner qu'un seul restaurant").waitFor();
    await client.getByRole("button", { name: "Garder mon panier" }).click();
    await client.goto(`${BASE}/panier`);
    await client.getByRole("heading", { name: "Le Maquis du Faso" }).waitFor({ timeout: 20000 });
  });

  let orderA = { id: "", code: "" };
  await check("7-9, 12. Connexion à la validation, livraison, espèces", async () => {
    await client.getByRole("link", { name: "Passer la commande" }).click();
    await client.waitForURL(/\/connexion/);
    await client.fill("#email", "client@dinego.bf");
    await client.fill("#password", creds["client@dinego.bf"]);
    await Promise.all([client.waitForURL(/\/commande$/), client.click("form button[type=submit]:has-text('Se connecter')")]);
    await client.selectOption("#zone_id", { label: "Ouaga 2000 (Ouagadougou)" });
    if (await client.locator("#new_details").isVisible()) await client.fill("#new_details", "Rue 15.32, porte bleue, près de la pharmacie");
    await client.locator("input[name=payment_method][value=cash]").check();
    // 1 700 (riz gras + œuf) + 400 (bissap -20 %) + 500 livraison
    await client.getByText("2 600 FCFA").first().waitFor({ timeout: 15000 });
    await Promise.all([client.waitForURL(/\/compte\/commandes\/.+placed=1/), client.getByRole("button", { name: "Confirmer la commande" }).click()]);
    orderA.id = client.url().split("/compte/commandes/")[1].split("?")[0];
    const { data } = await db.from("orders").select("code, total").eq("id", orderA.id).single();
    orderA.code = data.code;
    assert(data.total === 2600, `total ${data.total} au lieu de 2600`);
  });
  await check("34. Le client ne voit que le montant total", async () => {
    const text = await client.locator("main").innerText();
    assert(!/commission|part restaurant|part dinego|votre part/i.test(text), "ventilation visible par le client");
    const res = await client.evaluate(async () => {
      const r = await fetch(location.href);
      return r.text();
    });
    assert(!res.includes("dinego_share") && !res.includes("restaurant_share"), "ventilation présente dans le HTML client");
  });

  console.log("\n▶ Espace restaurant et livraison (réseau DineGo)");
  const resto = await session("maquis@dinego.bf");
  await check("21-22, 24. Réception, acceptation, commande prête", async () => {
    for (const b of ["Accepter", "Démarrer la préparation", "Commande prête"]) await act(resto, "/restaurant/commandes", orderA.code, b);
    const { data } = await db.from("orders").select("status").eq("id", orderA.id).single();
    assert(data.status === "awaiting_pickup", "statut " + data.status);
  });
  await check("25, 28. Sollicitation d'un livreur du réseau", async () => {
    const f = await act(resto, "/restaurant/commandes", orderA.code, "Affecter", (c) => c.locator("select[name=courier_id]").selectOption("network"));
    assert(f.includes("Mission proposée"), f);
  });

  const courier = await session("livreur@dinego.bf");
  await check("29-31. Livreur : acceptation, remise, encaissement espèces", async () => {
    for (const b of ["Accepter", "Commande récupérée", "Je suis arrivé", "Remise au client", "Confirmer l'encaissement"]) await act(courier, "/livreur", orderA.code, b);
    const { data } = await db.from("orders").select("status, payment_status").eq("id", orderA.id).single();
    assert(data.status === "completed" && data.payment_status === "confirmed", JSON.stringify(data));
  });
  await check("43. Double confirmation d'encaissement empêchée", async () => {
    const { data: u } = await db.from("profiles").select("id").eq("email", "livreur@dinego.bf").single();
    const { error } = await db.from("cash_confirmations").insert({ order_id: orderA.id, amount: 1, confirmed_by: u.id, confirmer_role: "livreur" });
    assert(error?.code === "23505", "doublon accepté par la base");
  });
  await check("32. Rémunération du livreur", async () => {
    await courier.goto(`${BASE}/livreur/remunerations`);
    await courier.getByRole("cell", { name: orderA.code }).first().waitFor({ timeout: 20000 });
    const { data } = await db.from("courier_earnings").select("amount, paid_by").eq("order_id", orderA.id).single();
    assert(data.amount === 500 && data.paid_by === "dinego", JSON.stringify(data));
  });
  await check("13, 15. Suivi terminé et évaluation", async () => {
    await client.goto(`${BASE}/compte/commandes/${orderA.id}`);
    await Promise.all([client.waitForURL(/ok=/), client.getByRole("button", { name: "Publier mon avis" }).click()]);
    const { data } = await db.from("reviews").select("rating_restaurant").eq("order_id", orderA.id).single();
    assert(data.rating_restaurant === 5, "avis absent");
  });
  await check("14. Historique client", async () => {
    await client.goto(`${BASE}/compte`);
    await client.getByText(orderA.code).first().waitFor({ timeout: 20000 });
  });
  await check("33, 35. Ventilation calculée, visible par le restaurant", async () => {
    const { data: f } = await db.from("order_financials").select("*").eq("order_id", orderA.id).single();
    assert(f.restaurant_share + f.courier_share + f.dinego_share === 2600, "ventilation incohérente");
    assert(f.restaurant_share === 1890 && f.courier_share === 500 && f.dinego_share === 210, JSON.stringify(f));
    await resto.goto(`${BASE}/restaurant/finances`);
    const row = resto.locator("tr").filter({ hasText: orderA.code });
    assert((await row.innerText()).includes("1 890 FCFA"), "part restaurant non affichée");
  });

  console.log("\n▶ Retrait + Orange Money, encaissement par le restaurant");
  let orderB = { id: "", code: "" };
  await check("10-11. Retrait et paiement numérique", async () => {
    await client.goto(`${BASE}/restaurants/grill-wend-kuuni`);
    const b = client.locator("article").filter({ has: client.getByRole("heading", { name: "Brochettes de bœuf (x5)" }) });
    await b.getByRole("button", { name: "Ajouter Brochettes de bœuf (x5)" }).click();
    await client.getByRole("dialog").getByRole("button", { name: /^Ajouter au panier/ }).click();
    await client.getByText("Ajouté au panier ✓").first().waitFor();
    await client.goto(`${BASE}/commande`);
    await client.locator("input[name=mode][value=pickup]").check();
    await client.locator("input[name=payment_method][value=orange_money]").check();
    await client.getByText("2 000 FCFA").last().waitFor({ timeout: 15000 });
    await Promise.all([client.waitForURL(/placed=1/), client.getByRole("button", { name: "Confirmer la commande" }).click()]);
    orderB.id = client.url().split("/compte/commandes/")[1].split("?")[0];
    orderB.code = (await db.from("orders").select("code").eq("id", orderB.id).single()).data.code;
    await client.goto(`${BASE}/compte/commandes/${orderB.id}`);
    await client.fill("input[name=reference]", "OM2611AB12");
    await Promise.all([client.waitForURL(/ok=/), client.getByRole("button", { name: "Envoyer", exact: true }).click()]);
    const { data } = await db.from("payments").select("status, reference, beneficiary").eq("order_id", orderB.id).single();
    assert(data.status === "pending" && data.reference === "OM2611AB12" && data.beneficiary === "restaurant", "déclaration client ≠ paiement confirmé : " + JSON.stringify(data));
  });
  const grill = await session("grill@dinego.bf");
  await check("38, 23. Bénéficiaire restaurant : vérification, remise", async () => {
    await act(grill, "/restaurant/commandes", orderB.code, "Accepter");
    await act(grill, "/restaurant/commandes", orderB.code, "Commande prête");
    await act(grill, "/restaurant/commandes", orderB.code, "Paiement reçu", (c) => c.locator("input[name=provider_reference]").fill("OM2611AB12"));
    await act(grill, "/restaurant/commandes", orderB.code, "Remise au client");
    const { data } = await db.from("orders").select("status, payment_status").eq("id", orderB.id).single();
    assert(data.status === "completed", JSON.stringify(data));
  });
  await check("39, 41, 44. Échéance de reversement quotidienne et retard", async () => {
    const past = new Date(Date.now() - 6 * 86400000).toISOString();
    await db.from("orders").update({ completed_at: past }).eq("id", orderB.id);
    await grill.goto(`${BASE}/restaurant/reversements`);
    const { data: f } = await db.from("order_financials").select("dinego_share, settlement_id").eq("order_id", orderB.id).single();
    assert(f.settlement_id, "échéance non constituée");
    const { data: st } = await db.from("settlements").select("*").eq("id", f.settlement_id).single();
    assert(st.direction === "to_dinego" && st.frequency === "daily" && st.amount_due >= f.dinego_share, JSON.stringify(st));
    assert(st.status === "late", "retard non détecté : " + st.status);
    await grill.getByText("En retard").first().waitFor({ timeout: 20000 });
  });

  console.log("\n▶ Inscriptions et administration");
  const admin = await session("admin@dinego.bf");
  const stamp = Date.now();
  await check("16-17. Inscription restaurant puis validation admin", async () => {
    const p = await session();
    await p.goto(`${BASE}/devenir-partenaire`);
    await p.fill("#full_name", "Test Responsable");
    await p.fill("#phone", "+226 70 99 99 99");
    await p.fill("#email", `resto${stamp}@test.dinego.bf`);
    await p.fill("#password", "MotDePasseTest1");
    await p.fill("#name", `Resto Test ${stamp}`);
    await p.fill("#city", "Ouagadougou");
    await p.fill("#address", "Rue test");
    await Promise.all([p.waitForURL(/\/restaurant/), p.getByRole("button", { name: "Envoyer mon inscription" }).click()]);
    const { data: r } = await db.from("restaurants").select("id, status, owner_id").eq("name", `Resto Test ${stamp}`).single();
    cleanup.push(r);
    assert(r.status === "pending", "statut initial " + r.status);
    await admin.goto(`${BASE}/admin/restaurants?status=pending`);
    await Promise.all([admin.waitForURL(/ok=/), admin.locator("li").filter({ hasText: `Resto Test ${stamp}` }).getByRole("button", { name: "Valider et mettre en ligne" }).click()]);
    const { data: r2 } = await db.from("restaurants").select("status").eq("id", r.id).single();
    assert(r2.status === "active", "non validé");
    await p.context().close();
  });
  await check("27. Inscription livreur", async () => {
    const p = await session();
    await p.goto(`${BASE}/devenir-livreur`);
    await p.fill("#full_name", "Livreur Test");
    await p.fill("#phone", "+226 71 00 00 00");
    await p.fill("#email", `livreur${stamp}@test.dinego.bf`);
    await p.fill("#password", "MotDePasseTest1");
    await Promise.all([p.waitForURL(/\/livreur/), p.getByRole("button", { name: "Envoyer ma candidature" }).click()]);
    const { data } = await db.from("couriers").select("id, status, user_id").eq("full_name", "Livreur Test").order("created_at", { ascending: false }).limit(1).single();
    cleanup.push({ courier: data });
    assert(data.status === "pending", data.status);
    await p.context().close();
  });
  await check("36, 46. Ventilation complète et réconciliation (admin)", async () => {
    await admin.goto(`${BASE}/admin/commandes?code=${orderA.code}`);
    await admin.getByText("210 FCFA").first().waitFor({ timeout: 20000 });
    const text = await admin.locator("main").innerText();
    assert(text.includes("Restaurant") && text.includes("1 890 FCFA") && text.includes("210 FCFA"), "ventilation admin incomplète");
    await admin.goto(`${BASE}/admin/finances`);
    await admin.getByRole("heading", { name: "Réconciliation financière" }).waitFor({ timeout: 20000 });
  });
  await check("Accès refusés selon le rôle", async () => {
    await client.goto(`${BASE}/admin`);
    await client.waitForURL((u) => !u.pathname.startsWith("/admin"), { timeout: 20000 });
    await courier.goto(`${BASE}/restaurant/finances`);
    await courier.waitForURL((u) => !u.pathname.startsWith("/restaurant"), { timeout: 20000 });
    assert(!(await courier.getByText("Historique des opérations").count()), "livreur a vu les finances restaurant");
    const { data: other } = await db.from("orders").select("id").eq("id", orderA.id).single();
    await grill.goto(`${BASE}/compte/commandes/${other.id}`);
    await grill.waitForURL((u) => !u.pathname.startsWith("/compte/commandes"), { timeout: 20000 }).catch(() => {});
    assert(!grill.url().includes(`/compte/commandes/${other.id}`) || (await grill.getByText("Page introuvable").isVisible()), "restaurant a vu la commande d'un client");
  });
  await check("47-49. Logo et bannières sur ordinateur et smartphone", async () => {
    const m = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const mp = await m.newPage();
    for (const path of ["/", "/restaurants", "/promotions", "/aide", "/connexion"]) {
      await mp.goto(BASE + path);
      await mp.getByRole("img", { name: "DineGo" }).first().waitFor({ timeout: 20000 });
      const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert(!overflow, `débordement horizontal sur ${path} (mobile)`);
    }
    await m.close();
  });
} finally {
  for (const r of before ?? []) await db.from("restaurants").update({ opens_at: r.opens_at, closes_at: r.closes_at, is_open: r.is_open }).eq("slug", r.slug);
  for (const c of cleanup) {
    if (c.courier) {
      await db.from("couriers").delete().eq("id", c.courier.id);
      await db.auth.admin.deleteUser(c.courier.user_id);
    } else {
      await db.from("restaurants").delete().eq("id", c.id);
      await db.auth.admin.deleteUser(c.owner_id);
    }
  }
  await browser.close();
}

console.log(`\n${passed} réussi(s), ${failures.length} échec(s)`);
if (failures.length) {
  console.log("Échecs : " + failures.join(" | "));
  process.exit(1);
}
