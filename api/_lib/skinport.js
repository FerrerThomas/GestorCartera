// Lógica compartida del proxy de precios de skins CS2 (Skinport).
// La usan api/cs2prices.js (Vercel, prod) y el middleware de Vite (dev) —
// misma URL relativa /api/cs2prices en los dos entornos.
//
// Skinport: sin API key, pero CORS cerrado y rate limit de 8 req / 5 min,
// por eso el cache en memoria con TTL de 5 minutos es obligatorio.

const SKINPORT_URL = 'https://api.skinport.com/v1/items?app_id=730&currency=USD';
const TTL_MS = 5 * 60 * 1000;

let cache = { at: 0, data: null };

export async function getCs2Prices() {
  const now = Date.now();
  if (cache.data && now - cache.at < TTL_MS) return cache.data;

  const res = await fetch(SKINPORT_URL, { headers: { 'Accept-Encoding': 'br' } });
  if (!res.ok) {
    if (cache.data) return cache.data; // mejor viejo que nada
    throw new Error(`Skinport respondió ${res.status}`);
  }
  const items = await res.json();
  const trimmed = [];
  for (const it of items) {
    const min = Number(it?.min_price);
    const median = Number(it?.median_price);
    if (!it?.market_hash_name || (!Number.isFinite(min) && !Number.isFinite(median))) continue;
    trimmed.push({
      name: it.market_hash_name,
      min: Number.isFinite(min) ? min : null,
      median: Number.isFinite(median) ? median : null,
    });
  }
  cache = { at: now, data: trimmed };
  return trimmed;
}
