// Données de démonstration DineGo : comptes de chaque profil, restaurants, menus, livreurs.
// Usage : node scripts/seed.mjs
// Les identifiants créés sont écrits dans credentials.local.txt (non versionné).
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CRED = "credentials.local.txt";
if (!existsSync(CRED)) writeFileSync(CRED, "Comptes DineGo (générés par scripts/seed.mjs) — à garder confidentiel\n\n");

const pwd = () => randomBytes(9).toString("base64url") + "a1";

async function account(email, role, full_name, phone) {
  const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return existing.id;
  const password = pwd();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: role === "admin" ? "client" : role, full_name, phone },
  });
  if (error) throw error;
  if (role === "admin") await db.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  appendFileSync(CRED, `${role.padEnd(10)} ${email.padEnd(32)} ${password}\n`);
  console.log(`+ compte ${role} ${email}`);
  return data.user.id;
}

const { data: cats } = await db.from("categories").select("id, slug");
const { data: zones } = await db.from("zones").select("id, name, city");
const cat = (s) => cats.find((c) => c.slug === s)?.id;
const zone = (n) => zones.find((z) => z.name === n)?.id;

const adminId = await account("admin@dinego.bf", "admin", "Administration DineGo", "+226 25 00 00 00");
await account("client@dinego.bf", "client", "Awa Ouédraogo", "+226 70 11 22 33");
const courierUser = await account("livreur@dinego.bf", "livreur", "Issa Kaboré", "+226 76 44 55 66");

const RESTAURANTS = [
  {
    owner: ["maquis@dinego.bf", "Salif Compaoré", "+226 70 10 10 10"],
    r: {
      name: "Le Maquis du Faso", slug: "le-maquis-du-faso", category_id: cat("maquis"), zone_id: zone("Ouaga 2000"), city: "Ouagadougou",
      address: "Avenue Pascal Zagré, Ouaga 2000", cuisine_type: "Burkinabè", price_level: 1, opens_at: "10:00", closes_at: "23:30",
      opening_hours: "Tous les jours 10h–23h30", featured: true, collection_mode: "dinego",
      description: "Le goût de la maison : riz gras, tô sauce gombo, poulet bicyclette braisé et jus de bissap frais, servis dans une ambiance conviviale.",
      delivery_zones: "Ouaga 2000, Patte d'Oie, Cissin", delivery_conditions: "Livraison 30 à 45 min selon la zone.",
    },
    menu: {
      "Plats principaux": [
        ["Riz gras", "Riz cuisiné à la tomate, légumes et viande de bœuf.", 1500, [["Œuf", 200], ["Viande en plus", 500]]],
        ["Tô sauce gombo", "Tô de maïs accompagné de sauce gombo au poisson fumé.", 1000, []],
        ["Poulet bicyclette braisé", "Demi-poulet bicyclette mariné et braisé au feu de bois.", 3500, [["Alloco", 500], ["Attiéké", 500]]],
      ],
      Accompagnements: [["Alloco", "Bananes plantains frites.", 700, []], ["Attiéké", "Semoule de manioc.", 500, []]],
      Boissons: [["Jus de bissap", "Fleurs d'hibiscus, menthe, gingembre.", 500, []], ["Jus de gingembre", "Pressé maison.", 500, []], ["Eau minérale 1,5 L", "", 600, []]],
    },
    promo: { title: "Jus offert… presque !", conditions: "Sur le jus de bissap, tous les jours", discount_percent: 20, product: "Jus de bissap" },
  },
  {
    owner: ["grill@dinego.bf", "Mariam Sawadogo", "+226 70 20 20 20"],
    r: {
      name: "Grill Wend-Kuuni", slug: "grill-wend-kuuni", category_id: cat("grillades"), zone_id: zone("Gounghin"), city: "Ouagadougou",
      address: "Rue 17.38, Gounghin", cuisine_type: "Grillades, brochettes", price_level: 2, opens_at: "17:00", closes_at: "02:00",
      opening_hours: "Tous les soirs 17h–2h", collection_mode: "restaurant", remittance_frequency: "daily",
      description: "Brochettes, poisson braisé et soupe de mouton : la grillade du soir comme on l'aime.",
      delivery_zones: "Gounghin, Pissy, Zone du Bois", delivery_conditions: "Commande minimum conseillée : 2 000 FCFA.",
    },
    menu: {
      Grillades: [
        ["Brochettes de bœuf (x5)", "Marinées aux épices kankankan.", 2000, [["Sauce piment", 0], ["Oignons frits", 200]]],
        ["Poisson braisé (capitaine)", "Capitaine entier braisé, sauce tomate oignon.", 5000, [["Attiéké", 500]]],
        ["Côtelettes d'agneau", "Quatre côtelettes grillées.", 4000, []],
      ],
      Entrées: [["Soupe de mouton", "Bouillon pimenté et morceaux de mouton.", 1500, []]],
      Boissons: [["Jus de tamarin", "", 500, []], ["Soda 33 cl", "", 500, []]],
    },
    promo: { title: "Soirée brochettes -10 %", conditions: "Dès 5 000 FCFA d'achat, sur toute la commande", discount_percent: 10, min_order: 5000 },
  },
  {
    owner: ["pizza@dinego.bf", "Jean-Baptiste Zongo", "+226 70 30 30 30"],
    r: {
      name: "Pizzeria Kadiogo", slug: "pizzeria-kadiogo", category_id: cat("pizzerias"), zone_id: zone("Koulouba"), city: "Ouagadougou",
      address: "Avenue Kwame Nkrumah, Koulouba", cuisine_type: "Italienne", price_level: 2, opens_at: "11:00", closes_at: "23:00",
      opening_hours: "Mar–Dim 11h–23h", accepts_scheduled: true, accepts_reservations: true, collection_mode: "dinego",
      description: "Pizzas cuites au four à bois et pâtes fraîches, avec une touche locale.",
    },
    menu: {
      Pizzas: [
        ["Margherita", "Tomate, mozzarella, basilic.", 4000, [["Supplément fromage", 700]]],
        ["Pizza Sahel", "Tomate, mozzarella, poulet braisé, oignons, piment doux.", 5500, [["Supplément fromage", 700]]],
      ],
      Desserts: [["Tiramisu", "Fait maison.", 2000, []]],
      Boissons: [["Jus de baobab (bouye)", "", 700, []]],
    },
  },
  {
    owner: ["patisserie@dinego.bf", "Aminata Traoré", "+226 70 40 40 40"],
    r: {
      name: "Délices de Sya", slug: "delices-de-sya", category_id: cat("patisseries"), zone_id: zone("Centre-ville"), city: "Bobo-Dioulasso",
      address: "Avenue de la Nation, Bobo-Dioulasso", cuisine_type: "Pâtisserie, viennoiserie", price_level: 2, opens_at: "06:30", closes_at: "20:00",
      opening_hours: "Tous les jours 6h30–20h", offers_delivery: false, collection_mode: "dinego",
      description: "Viennoiseries, gâteaux d'anniversaire et beignets de Bobo.",
    },
    menu: {
      Pâtisseries: [["Croissant", "", 400, []], ["Gâteau au chocolat (part)", "", 1200, []], ["Beignets (x6)", "Beignets de farine sucrés.", 500, []]],
      Boissons: [["Café touba", "", 300, []]],
    },
  },
];

for (const def of RESTAURANTS) {
  const ownerId = await account(...[def.owner[0], "restaurant", def.owner[1], def.owner[2]]);
  let { data: resto } = await db.from("restaurants").select("id").eq("slug", def.r.slug).maybeSingle();
  if (!resto) {
    ({ data: resto } = await db
      .from("restaurants")
      .insert({ ...def.r, owner_id: ownerId, manager_name: def.owner[1], phone: def.owner[2], email: def.owner[0], status: "active", validated_at: new Date().toISOString() })
      .select("id")
      .single());
    let sort = 1;
    for (const [section, items] of Object.entries(def.menu)) {
      const { data: mc } = await db.from("menu_categories").insert({ restaurant_id: resto.id, name: section, sort: sort++ }).select("id").single();
      await db.from("products").insert(
        items.map(([name, description, price, options]) => ({
          restaurant_id: resto.id,
          menu_category_id: mc.id,
          name,
          description: description || null,
          price,
          options: options.map(([n, p]) => ({ name: n, price: p })),
        })),
      );
    }
    if (def.promo) {
      const productId = def.promo.product ? (await db.from("products").select("id").eq("restaurant_id", resto.id).eq("name", def.promo.product).single()).data?.id : null;
      await db.from("promotions").insert({
        restaurant_id: resto.id,
        product_id: productId ?? null,
        title: def.promo.title,
        conditions: def.promo.conditions,
        discount_percent: def.promo.discount_percent,
        min_order: def.promo.min_order ?? 0,
      });
    }
    console.log(`+ restaurant ${def.r.name}`);
  }
  if (def.r.slug === "grill-wend-kuuni") {
    const { count } = await db.from("couriers").select("id", { count: "exact", head: true }).eq("restaurant_id", resto.id);
    if (!count) await db.from("couriers").insert({ restaurant_id: resto.id, network: "restaurant", full_name: "Boukary Ouédraogo", phone: "+226 65 00 11 22", zone_id: zone("Gounghin"), vehicle: "Moto", status: "active" });
  }
}

const { data: c } = await db.from("couriers").select("id").eq("user_id", courierUser).maybeSingle();
if (!c) {
  await db.from("couriers").insert({ user_id: courierUser, network: "dinego", full_name: "Issa Kaboré", phone: "+226 76 44 55 66", zone_id: zone("Ouaga 2000"), vehicle: "Moto", status: "active" });
  console.log("+ livreur réseau DineGo");
}
void adminId;
console.log(`\nTerminé. Identifiants dans ${CRED}.`);
