// Each fetcher swallows its own errors and returns an empty/null result instead of
// throwing, so one failing source never breaks the others or crashes the poll.

async function safeFetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchDolarBlue() {
  const data = await safeFetchJson('https://dolarapi.com/v1/dolares/blue');
  const venta = Number(data?.venta);
  return Number.isFinite(venta) ? venta : null;
}

async function fetchData912Catalog(path) {
  const data = await safeFetchJson(`https://data912.com${path}`);
  const list = [];
  if (Array.isArray(data)) {
    for (const row of data) {
      const price = Number(row?.c);
      if (row?.symbol && Number.isFinite(price)) list.push({ ticker: row.symbol, price });
    }
  }
  return list;
}

export function fetchArgStocksCatalog() {
  return fetchData912Catalog('/live/arg_stocks');
}

export function fetchArgCedearsCatalog() {
  return fetchData912Catalog('/live/arg_cedears');
}

function catalogToMap(catalog) {
  const map = {};
  for (const { ticker, price } of catalog) map[ticker] = price;
  return map;
}

export async function fetchArgStocks() {
  return catalogToMap(await fetchArgStocksCatalog());
}

export async function fetchArgCedears() {
  return catalogToMap(await fetchArgCedearsCatalog());
}

function parseBinanceRow(row, map) {
  const price = Number(row?.price);
  const ticker = String(row?.symbol ?? '').replace(/USDT$/, '');
  if (ticker && Number.isFinite(price)) map[ticker] = price;
}

export async function fetchCryptoPrices(tickers) {
  const map = {};
  // USDT es la moneda de cotización de los pares: vale 1 USD por definición y
  // "USDTUSDT" no existe en Binance — incluirlo en el batch tira 400 para TODOS.
  const rest = [];
  for (const t of tickers) {
    if (t === 'USDT') map.USDT = 1;
    else rest.push(t);
  }
  if (!rest.length) return map;
  const symbols = rest.map((t) => `${t}USDT`);
  const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(
    JSON.stringify(symbols)
  )}`;
  const data = await safeFetchJson(url);
  if (Array.isArray(data)) {
    for (const row of data) parseBinanceRow(row, map);
    return map;
  }
  // El batch falla entero si UN símbolo es inválido (400) — reintento de a uno
  // para que un ticker sin par en Binance no mate los precios del resto.
  const singles = await Promise.all(
    rest.map((t) => safeFetchJson(`https://api.binance.com/api/v3/ticker/price?symbol=${t}USDT`))
  );
  for (const row of singles) if (row) parseBinanceRow(row, map);
  return map;
}
