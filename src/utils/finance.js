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

export function formatQty(qty) {
  return qty.toLocaleString('es-AR', { maximumFractionDigits: 3 });
}

export function formatPct(pct, withSign = true) {
  const sign = pct >= 0 ? '+' : '−';
  const txt = Math.abs(pct).toFixed(1).replace('.', ',') + '%';
  return withSign ? sign + txt : txt;
}

// Value of one asset's position expressed in ARS.
export function assetValueARS(asset) {
  if (asset.kind === 'fund') return asset.value;
  const price = asset.currentPrice ?? 0;
  const qty = asset.qty ?? 0;
  return asset.currency === 'USD' ? qty * price * USD_ARS : qty * price;
}

export function assetInvestedARS(asset) {
  if (asset.kind === 'fund') return asset.value - (asset.gainAbs ?? 0);
  const price = asset.avgPrice ?? 0;
  const qty = asset.qty ?? 0;
  return asset.currency === 'USD' ? qty * price * USD_ARS : qty * price;
}

export function assetGainARS(asset) {
  if (asset.kind === 'fund') return asset.gainAbs ?? 0;
  return assetValueARS(asset) - assetInvestedARS(asset);
}

export function assetGainPct(asset) {
  const invested = assetInvestedARS(asset);
  if (!invested) return 0;
  return (assetGainARS(asset) / invested) * 100;
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
