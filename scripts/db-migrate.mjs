// Applique les migrations SQL de supabase/migrations via l'API Management de Supabase.
// Usage : node scripts/db-migrate.mjs
// Requiert SUPABASE_ACCESS_TOKEN et SUPABASE_PROJECT_REF dans .env.local
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./env.mjs";

const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error("SUPABASE_ACCESS_TOKEN et SUPABASE_PROJECT_REF sont requis dans .env.local");
  process.exit(1);
}

export async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

await runSql(`create table if not exists public._migrations (
  name text primary key, applied_at timestamptz not null default now()
); alter table public._migrations enable row level security;`);

const applied = new Set((await runSql("select name from public._migrations")).map((r) => r.name));
const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  if (applied.has(file)) {
    console.log(`= ${file} (déjà appliquée)`);
    continue;
  }
  const sql = readFileSync(join(dir, file), "utf8");
  const safeName = file.replace(/'/g, "''");
  console.log(`> ${file}…`);
  // Exécution dans une transaction : tout ou rien
  await runSql(`begin;\n${sql}\ninsert into public._migrations (name) values ('${safeName}');\ncommit;`);
  console.log(`✓ ${file}`);
}
console.log("Migrations à jour.");
