// Rendimiento real de billeteras, desde la API pública de ArgentinaDatos.
//  * FCI money market: valor de la cuotaparte (vcp) del último día publicado
//    y del anterior → la TNA sale de cuánto subió la cuotaparte.
//  * Tasas publicadas por algunas billeteras (/finanzas/rendimientos).
// Los fondos publican con unos días de atraso: el "último" dato puede ser de
// hace 2-5 días, por eso se muestra la fecha.

const BASE = 'https://api.argentinadatos.com/v1/finanzas';
const TTL_MS = 30 * 60 * 1000;
let fciCache = { at: 0, promise: null };
let ratesCache = { at: 0, promise: null };

async function getJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// TNA implícita entre dos valores de cuotaparte.
export function tnaFromVcp(vcpNow, vcpPrev, days) {
  if (!(vcpNow > 0) || !(vcpPrev > 0) || !(days > 0)) return null;
  return ((vcpNow / vcpPrev - 1) * 365 * 100) / days;
}

// { [fondo]: { vcp, fecha, tna } }
export function fetchFciLatest() {
  if (fciCache.promise && Date.now() - fciCache.at < TTL_MS) return fciCache.promise;
  fciCache = {
    at: Date.now(),
    promise: Promise.all([
      getJson(`${BASE}/fci/mercadoDinero/ultimo`),
      getJson(`${BASE}/fci/mercadoDinero/penultimo`),
    ]).then(([last, prev]) => {
      const map = {};
      const prevBy = {};
      for (const r of Array.isArray(prev) ? prev : []) prevBy[r.fondo] = r;
      for (const r of Array.isArray(last) ? last : []) {
        const vcp = Number(r.vcp);
        if (!r.fondo || !(vcp > 0)) continue;
        const p = prevBy[r.fondo];
        const days = p ? Math.round((new Date(r.fecha) - new Date(p.fecha)) / 86400000) : 0;
        map[r.fondo] = { vcp, fecha: r.fecha, tna: p ? tnaFromVcp(vcp, Number(p.vcp), days) : null };
      }
      if (!Object.keys(map).length) fciCache = { at: 0, promise: null }; // reintentar la próxima
      return map;
    }),
  };
  return fciCache.promise;
}

// { [entidad]: tna en ARS }
export function fetchWalletRates() {
  if (ratesCache.promise && Date.now() - ratesCache.at < TTL_MS) return ratesCache.promise;
  ratesCache = {
    at: Date.now(),
    promise: getJson(`${BASE}/rendimientos`).then((list) => {
      const map = {};
      for (const e of Array.isArray(list) ? list : []) {
        const ars = e.rendimientos?.find((r) => r.moneda === 'ARS');
        if (ars && Number.isFinite(Number(ars.apy))) map[e.entidad] = Number(ars.apy);
      }
      return map;
    }),
  };
  return ratesCache.promise;
}
