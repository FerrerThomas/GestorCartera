// Edge Function: quick-action
//
// Endpoint para los Atajos de iOS (y cualquier cliente sin sesión de Supabase).
// Se autentica con un token personal (Ajustes → Atajos de iOS en la app), no
// con el JWT de Supabase: la sesión vence cada hora y un Atajo no la renueva.
//
//   GET  /quick-action            → cuentas, categorías y resumen del mes
//   POST /quick-action  {type, amount, account?, to_account?, category?, note?, date?, currency?}
//        type: gasto | ingreso | transferencia (o expense | income | transfer)
//        account / to_account / category: nombre (sin importar mayúsculas ni
//        tildes) o id.
//
// Siempre responde JSON con { ok, message } para que el Atajo muestre
// `message` en una notificación, salga bien o mal.
//
// DEPLOY: esta función NO verifica el JWT de Supabase (usa su propio token).
//   Dashboard → Edge Functions → quick-action → desactivar "Enforce JWT verification"
//   o por CLI: supabase functions deploy quick-action --no-verify-jwt

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// "Mercado Pago" == "mercado pago" == "MERCADO PÁGO"
function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .toLowerCase();
}

// Acepta 12500, "12500.5", "12.500,50", "$ 12.500".
function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  let s = String(raw ?? "").replace(/[^\d.,-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function fmt(amount: number, currency: string): string {
  const n = amount.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return currency === "USD" ? `US$${n}` : `$${n}`;
}

const TYPE_ALIASES: Record<string, "expense" | "income" | "transfer"> = {
  gasto: "expense",
  expense: "expense",
  ingreso: "income",
  income: "income",
  saldo: "income",
  "agregar saldo": "income",
  transferencia: "transfer",
  transferir: "transfer",
  transfer: "transfer",
  mover: "transfer",
};

const TYPE_LABEL = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia" };

type Account = { id: string; name: string; currency: string; type: string };
type Category = {
  id: string;
  name: string;
  emoji: string | null;
  kind: string;
  monthly_budget: number | null;
};

function findByName<T extends { id: string; name: string }>(list: T[], wanted: unknown): T | null {
  if (wanted == null || wanted === "") return null;
  const w = norm(wanted);
  return (
    list.find((x) => x.id === wanted) ??
    list.find((x) => norm(x.name) === w) ??
    // "🍔 Comida" (lo que muestra el menú del Atajo) → "Comida"
    list.find((x) => w.endsWith(norm(x.name)) && norm(x.name).length > 0) ??
    null
  );
}

async function fetchDolarBlue(): Promise<number | null> {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/blue");
    if (!res.ok) return null;
    const v = Number((await res.json())?.venta);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function monthStartART(): string {
  const d = new Date(Date.now() - 3 * 3600000);
  return `${d.toISOString().slice(0, 7)}-01`;
}

async function monthSummary(db: SupabaseClient, userId: string, categories: Category[]) {
  const [{ data: rows }, { data: snap }] = await Promise.all([
    db
      .from("movements")
      .select("type, amount, currency, category_id")
      .eq("user_id", userId)
      .gte("occurred_on", monthStartART()),
    db
      .from("portfolio_snapshots")
      .select("total_ars, total_usd, snapshot_date")
      .eq("user_id", userId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const spent: Record<string, number> = { ARS: 0, USD: 0 };
  const income: Record<string, number> = { ARS: 0, USD: 0 };
  const byCat: Record<string, number> = {};
  for (const r of rows ?? []) {
    if (r.type === "expense") {
      spent[r.currency] += Number(r.amount);
      if (r.category_id && r.currency === "ARS") {
        byCat[r.category_id] = (byCat[r.category_id] ?? 0) + Number(r.amount);
      }
    } else if (r.type === "income") income[r.currency] += Number(r.amount);
  }
  const budgets = categories
    .filter((c) => c.kind === "expense" && c.monthly_budget)
    .map((c) => ({
      category: c.name,
      budget: Number(c.monthly_budget),
      spent: byCat[c.id] ?? 0,
      left: Number(c.monthly_budget) - (byCat[c.id] ?? 0),
    }));
  const lines = [`Gastaste ${fmt(spent.ARS, "ARS")} este mes`];
  if (spent.USD) lines[0] += ` y ${fmt(spent.USD, "USD")}`;
  if (snap) lines.push(`Patrimonio: ${fmt(Number(snap.total_ars), "ARS")}`);
  for (const b of budgets.filter((b) => b.left < b.budget * 0.2)) {
    lines.push(
      b.left >= 0
        ? `⚠️ ${b.category}: te quedan ${fmt(b.left, "ARS")}`
        : `🔴 ${b.category}: te pasaste ${fmt(-b.left, "ARS")}`,
    );
  }
  return {
    month_expenses: spent,
    month_income: income,
    portfolio_total_ars: snap ? Number(snap.total_ars) : null,
    portfolio_total_usd: snap ? Number(snap.total_usd) : null,
    portfolio_date: snap?.snapshot_date ?? null,
    budgets,
    text: lines.join("\n"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // --- Auth por token personal ---
  const raw = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!raw.startsWith("pa_")) {
    return reply({ ok: false, message: "Falta el token. Generalo en la app: Ajustes → Atajos de iOS." }, 401);
  }
  const { data: token } = await db
    .from("api_tokens")
    .select("id, user_id")
    .eq("token_hash", await sha256Hex(raw))
    .is("revoked_at", null)
    .maybeSingle();
  if (!token) return reply({ ok: false, message: "Token inválido o revocado." }, 401);
  const userId = token.user_id as string;
  await Promise.all([
    db.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", token.id),
    db.rpc("seed_default_categories", { p_user_id: userId }),
  ]);
  const [{ data: accountsData }, { data: categoriesData }] = await Promise.all([
    db.from("accounts").select("id, name, currency, type").eq("user_id", userId).order("created_at"),
    db
      .from("categories")
      .select("id, name, emoji, kind, monthly_budget")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("sort_order"),
  ]);
  const accounts = (accountsData ?? []) as Account[];
  const categories = (categoriesData ?? []) as Category[];
  // Cuentas donde tiene sentido mover plata (no brokers/exchanges/steam).
  const cashAccounts = accounts.filter((a) => a.type === "billetera" || a.type === "efectivo");
  const label = (c: Category) => (c.emoji ? `${c.emoji} ${c.name}` : c.name);

  // --- GET: contexto para armar los menús del Atajo ---
  if (req.method === "GET") {
    const summary = await monthSummary(db, userId, categories);
    return reply({
      ok: true,
      message: summary.text,
      accounts: (cashAccounts.length ? cashAccounts : accounts).map((a) => a.name),
      all_accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency, type: a.type })),
      expense_categories: categories.filter((c) => c.kind === "expense").map(label),
      income_categories: categories.filter((c) => c.kind === "income").map(label),
      summary,
    });
  }

  if (req.method !== "POST") return reply({ ok: false, message: "Método no soportado." }, 405);

  // --- POST: registrar movimiento ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, message: "El cuerpo tiene que ser JSON." }, 400);
  }

  const type = TYPE_ALIASES[norm(body.type)];
  if (!type) return reply({ ok: false, message: "type tiene que ser gasto, ingreso o transferencia." });

  const amount = parseAmount(body.amount);
  if (!(amount > 0)) return reply({ ok: false, message: "Monto inválido." });

  // Para gasto/transferencia la cuenta principal es el origen; para ingreso, el destino.
  const defaultAccount = cashAccounts[0] ?? accounts[0] ?? null;
  const main = body.account ? findByName(accounts, body.account) : defaultAccount;
  if (!main) return reply({ ok: false, message: `No encontré la cuenta "${body.account ?? ""}".` });
  let to: Account | null = null;
  if (type === "transfer") {
    to = findByName(accounts, body.to_account);
    if (!to) return reply({ ok: false, message: `No encontré la cuenta destino "${body.to_account ?? ""}".` });
  }

  let category: Category | null = null;
  if (body.category && type !== "transfer") {
    const kind = type === "income" ? "income" : "expense";
    category = findByName(categories.filter((c) => c.kind === kind), body.category);
    if (!category) return reply({ ok: false, message: `No encontré la categoría "${body.category}".` });
  }

  const currency = String(body.currency || main.currency).toUpperCase();
  const usdRate = currency === "USD" ? await fetchDolarBlue() : null;
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;

  const { data: movement, error } = await db.rpc("register_movement", {
    p_type: type,
    p_amount: amount,
    p_currency: currency,
    p_from_account: type === "income" ? null : main.id,
    p_to_account: type === "income" ? main.id : to?.id ?? null,
    p_category: category?.id ?? null,
    p_note: typeof body.note === "string" ? body.note : null,
    p_occurred_on: date,
    p_usd_rate: usdRate,
    p_source: "shortcut",
    p_user_id: userId,
  });
  if (error) return reply({ ok: false, message: `❌ ${error.message}` });

  let message = `✅ ${TYPE_LABEL[type]} de ${fmt(amount, currency)}`;
  if (category) message += ` en ${label(category)}`;
  message += type === "transfer" ? ` · ${main.name} → ${to!.name}` : ` · ${main.name}`;

  if (category?.monthly_budget && currency === "ARS") {
    const { data: rows } = await db
      .from("movements")
      .select("amount")
      .eq("user_id", userId)
      .eq("type", "expense")
      .eq("currency", "ARS")
      .eq("category_id", category.id)
      .gte("occurred_on", monthStartART());
    const spent = (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const left = Number(category.monthly_budget) - spent;
    message += left >= 0
      ? `\nTe quedan ${fmt(left, "ARS")} de ${category.name} este mes`
      : `\n🔴 Te pasaste ${fmt(-left, "ARS")} del presupuesto de ${category.name}`;
  }

  return reply({ ok: true, message, movement });
});
