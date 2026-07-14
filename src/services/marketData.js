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

export async function fetchCryptoPrices(tickers) {
  const map = {};
  if (!tickers.length) return map;
  const symbols = tickers.map((t) => `${t}USDT`);
  const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(
    JSON.stringify(symbols)
  )}`;
  const data = await safeFetchJson(url);
  if (Array.isArray(data)) {
    for (const row of data) {
      const price = Number(row?.price);
      const ticker = String(row?.symbol ?? '').replace(/USDT$/, '');
      if (ticker && Number.isFinite(price)) map[ticker] = price;
    }
  }
  return map;
}
