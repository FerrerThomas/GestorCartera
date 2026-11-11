// Edge Function: daily-snapshot
//
// Corre una vez por día (pg_cron -> pg_net -> esta función) y hace dos cosas:
//   1. Refresca assets.current_price con el precio vivo de cada activo
//      (dolarapi para el blue, data912 para acciones/CEDEARs, Binance para cripto).
//   2. Calcula el valor total de la cartera de CADA usuario y hace upsert del
//      snapshot del día en portfolio_snapshots (total_ars + total_usd).
//
// Usa el service role key (inyectado automáticamente en el runtime de edge
// functions), así que bypassa RLS a propósito: procesa todos los usuarios.

import { createClient } from "npm:@supabase/supabase-js@2";

const DAY_MS = 86400000;

async function safeFetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchDolarBlue(): Promise<number | null> {
  const data = (await safeFetchJson("https://dolarapi.com/v1/dolares/blue")) as
    | { venta?: number }
    | null;
  const venta = Number(data?.venta);
  return Number.isFinite(venta) ? venta : null;
}

async function fetchData912(path: string): Promise<Record<string, number>> {
  const data = await safeFetchJson(`https://data912.com${path}`);
  const map: Record<string, number> = {};
  if (Array.isArray(data)) {
    for (const row of data) {
      const price = Number(row?.c);
      if (row?.symbol && Number.isFinite(price)) map[row.symbol] = price;
    }
  }
  return map;
}

function parseBinanceRow(row: unknown, map: Record<string, number>) {
  const r = row as { symbol?: string; price?: string } | null;
  const price = Number(r?.price);
  const ticker = String(r?.symbol ?? "").replace(/USDT$/, "");
  if (ticker && Number.isFinite(price)) map[ticker] = price;
}

async function fetchCrypto(tickers: string[]): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  // USDT vale 1 USD por definición; "USDTUSDT" no existe y rompe el batch entero.
  const rest = tickers.filter((t) => {
    if (t === "USDT") {
      map.USDT = 1;
      return false;
    }
    return true;
  });
  if (!rest.length) return map;
  const symbols = rest.map((t) => `${t}USDT`);
  const data = await safeFetchJson(
    `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbols))}`,
  );
  if (Array.isArray(data)) {
    for (const row of data) parseBinanceRow(row, map);
    return map;
  }
  // Batch inválido (un símbolo malo tira 400 para todos): reintento de a uno.
  const singles = await Promise.all(
    rest.map((t) => safeFetchJson(`https://api.binance.com/api/v3/ticker/price?symbol=${t}USDT`)),
  );
  for (const row of singles) if (row) parseBinanceRow(row, map);
  return map;
}

// Días calendario desde una fecha "YYYY-MM-DD" o timestamptz, nunca negativo.
// Skins CS2: precio mínimo de mercado en USD desde Skinport (una sola llamada
// para todo el catálogo). Deno maneja brotli y no hay CORS server-side.
async function fetchCs2(hasSkins: boolean): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  if (!hasSkins) return map;
  const data = await safeFetchJson("https://api.skinport.com/v1/items?app_id=730&currency=USD");
  if (Array.isArray(data)) {
    for (const row of data) {
      const min = Number(row?.min_price);
      if (row?.market_hash_name && Number.isFinite(min)) map[row.market_hash_name] = min;
    }
  }
  return map;
}

function daysSince(dateInput: string): number {
  let t: number | null = null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateInput ?? ""));
  if (m) t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (t == null) t = new Date(dateInput).getTime();
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

// Fecha de HOY en Argentina (UTC-3) como "YYYY-MM-DD".
function todayART(): string {
  return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
}

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const [{ data: assets, error: assetsErr }, { data: history, error: histErr }] =
    await Promise.all([
      supabase
        .from("assets")
        .select("id, user_id, ticker, category, currency, kind, fund_value, fund_tna, current_price, created_at"),
      supabase.from("asset_history").select("asset_id, qty, price, occurred_on"),
    ]);
  if (assetsErr || histErr) {
    return new Response(JSON.stringify({ error: (assetsErr ?? histErr)!.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const histByAsset: Record<string, { qty: number; price: number; occurred_on: string }[]> = {};
  for (const h of history ?? []) {
    (histByAsset[h.asset_id] ??= []).push(h);
  }

  const cryptoTickers = [
    ...new Set(
      (assets ?? []).filter((a) => a.category === "Cripto").map((a) => a.ticker as string),
    ),
  ];
  const hasSkins = (assets ?? []).some((a) => a.category === "Skin CS2");
  const [blue, stocks, cedears, crypto, skins] = await Promise.all([
    fetchDolarBlue(),
    fetchData912("/live/arg_stocks"),
    fetchData912("/live/arg_cedears"),
    fetchCrypto(cryptoTickers),
    fetchCs2(hasSkins),
  ]);

  const liveFor = (a: { ticker: string; category: string }): number | null => {
    if (a.category === "Acción") return stocks[a.ticker] ?? null;
    if (a.category === "CEDEAR") return cedears[a.ticker] ?? null;
    if (a.category === "Cripto") return crypto[a.ticker] ?? null;
    if (a.category === "Skin CS2") return skins[a.ticker] ?? null;
    if (a.category === "Efectivo") return a.ticker === "USD" ? blue : null;
    return null;
  };

  // 1. Refrescar current_price.
  let pricesUpdated = 0;
  for (const a of assets ?? []) {
    if (a.kind === "fund") continue;
    const live = liveFor(a);
    if (live == null || Number(a.current_price) === live) continue;
    const { error } = await supabase.from("assets").update({ current_price: live }).eq("id", a.id);
    if (!error) pricesUpdated++;
  }

  // 2. Snapshot por usuario.
  const usdArs = blue ?? 1180;
  const totals: Record<string, number> = {};
  for (const a of assets ?? []) {
    const rows = histByAsset[a.id] ?? [];
    let valueARS = 0;
    if (a.kind === "fund") {
      const dailyRate = Number(a.fund_tna ?? 0) / 100 / 365;
      const principal = Number(a.fund_value ?? 0);
      let accrued = 0;
      if (dailyRate > 0) {
        accrued = rows.length
          ? rows.reduce(
              (sum, h) => sum + Number(h.qty) * (Math.pow(1 + dailyRate, daysSince(h.occurred_on)) - 1),
              0,
            )
          : principal * (Math.pow(1 + dailyRate, daysSince(a.created_at)) - 1);
      }
      valueARS = principal + accrued;
    } else {
      const qty = rows.reduce((sum, h) => sum + Number(h.qty), 0);
      const price = liveFor(a) ?? Number(a.current_price ?? 0);
      valueARS = qty * price * (a.currency === "USD" ? usdArs : 1);
    }
    totals[a.user_id] = (totals[a.user_id] ?? 0) + valueARS;
  }

  const snapshotDate = todayART();
  const snapshots = Object.entries(totals).map(([user_id, total_ars]) => ({
    user_id,
    snapshot_date: snapshotDate,
    total_ars,
    total_usd: total_ars / usdArs,
  }));
  let snapshotsUpserted = 0;
  if (snapshots.length) {
    const { error } = await supabase
      .from("portfolio_snapshots")
      .upsert(snapshots, { onConflict: "user_id,snapshot_date" });
    if (error) {
      return new Response(JSON.stringify({ error: error.message, pricesUpdated }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    snapshotsUpserted = snapshots.length;
  }

  return new Response(
    JSON.stringify({ ok: true, snapshotDate, pricesUpdated, snapshotsUpserted, dolarBlue: blue }),
    { headers: { "Content-Type": "application/json" } },
  );
});
