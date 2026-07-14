// Fallback USD/ARS rate used only before the first live dolarBlue fetch resolves,
// or if the API is unreachable. The live rate (from useMarketData) is passed in
// explicitly to every function below.
export const USD_ARS = 1180;

export function parseLocaleNumber(raw) {
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatARS(value) {
  return '$' + Math.round(value).toLocaleString('es-AR');
}

export function formatUSD(value) {
  return 'US$' + Math.round(value).toLocaleString('es-AR');
}

export function formatMoney(value, currency) {
  return currency === 'USD' ? formatUSD(value) : formatARS(value);
}

// Converts an amount denominated in `fromCurrency` into `toCurrency`.
export function convertAmount(value, fromCurrency, toCurrency, usdArs = USD_ARS) {
  const from = fromCurrency === 'USD' ? 'USD' : 'ARS';
  const to = toCurrency === 'USD' ? 'USD' : 'ARS';
  if (from === to) return value;
  return from === 'USD' ? value * usdArs : value / usdArs;
}

export function formatQty(qty) {
  return qty.toLocaleString('es-AR', { maximumFractionDigits: 3 });
}

export function formatPct(pct, withSign = true) {
  const sign = pct >= 0 ? '+' : '−';
  const txt = Math.abs(pct).toFixed(1).replace('.', ',') + '%';
  return withSign ? sign + txt : txt;
}

// Value of one asset's position expressed in ARS.
export function assetValueARS(asset, usdArs = USD_ARS) {
  if (asset.kind === 'fund') return asset.value;
  const price = asset.currentPrice ?? 0;
  const qty = asset.qty ?? 0;
  return asset.currency === 'USD' ? qty * price * usdArs : qty * price;
}

export function assetInvestedARS(asset, usdArs = USD_ARS) {
  if (asset.kind === 'fund') return asset.value - (asset.gainAbs ?? 0);
  const price = asset.avgPrice ?? 0;
  const qty = asset.qty ?? 0;
  return asset.currency === 'USD' ? qty * price * usdArs : qty * price;
}

export function assetGainARS(asset, usdArs = USD_ARS) {
  if (asset.kind === 'fund') return asset.gainAbs ?? 0;
  return assetValueARS(asset, usdArs) - assetInvestedARS(asset, usdArs);
}

export function assetGainPct(asset, usdArs = USD_ARS) {
  const invested = assetInvestedARS(asset, usdArs);
  if (!invested) return 0;
  return (assetGainARS(asset, usdArs) / invested) * 100;
}

// Weighted-average purchase price after adding a new buy.
export function calcAveragePrice(prevQty, prevAvgPrice, addQty, addPrice) {
  const newQty = prevQty + addQty;
  const newInvested = prevQty * prevAvgPrice + addQty * addPrice;
  const newAvgPrice = newQty > 0 ? newInvested / newQty : 0;
  return { newQty, newInvested, newAvgPrice };
}

export function formatDateDDMMYYYY(dateInput) {
  // Plain "YYYY-MM-DD" (e.g. a Postgres `date` column) has no timezone —
  // parse it manually so we don't shift a day via UTC->local conversion.
  if (typeof dateInput === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateInput);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = dateInput ? new Date(dateInput) : new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function todayDDMMYYYY() {
  return formatDateDDMMYYYY();
}
