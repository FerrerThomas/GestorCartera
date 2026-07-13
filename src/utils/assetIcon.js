// Icon presentation is derived from the ticker, never stored per-user-row in the DB.
const KNOWN_ICONS = {
  GGAL: { iconBg: 'rgba(184,227,74,.14)', iconColor: '#b8e34a', iconLabel: 'GG' },
  YPF: { iconBg: 'rgba(55,193,242,.14)', iconColor: '#37c1f2', iconLabel: 'YP' },
  AAPL: { iconBg: 'rgba(255,255,255,.1)', iconColor: '#e8eaee', iconLabel: 'AA' },
  MELI: { iconBg: 'rgba(242,161,55,.14)', iconColor: '#f2a137', iconLabel: 'ME' },
  BTC: { iconBg: 'rgba(242,161,55,.14)', iconColor: '#f2a137', iconLabel: '₿' },
  ETH: { iconBg: 'rgba(140,120,250,.16)', iconColor: '#a897ff', iconLabel: 'Ξ' },
  'FCI.MP': { iconBg: 'rgba(55,193,242,.14)', iconColor: '#37c1f2', iconLabel: 'MP' },
  USD: { iconBg: 'rgba(255,255,255,.1)', iconColor: '#e8eaee', iconLabel: 'U$' },
};

const FALLBACK_PALETTE = [
  { iconBg: 'rgba(184,227,74,.14)', iconColor: '#b8e34a' },
  { iconBg: 'rgba(55,193,242,.14)', iconColor: '#37c1f2' },
  { iconBg: 'rgba(242,161,55,.14)', iconColor: '#f2a137' },
  { iconBg: 'rgba(140,120,250,.16)', iconColor: '#a897ff' },
  { iconBg: 'rgba(240,112,95,.14)', iconColor: '#f0705f' },
  { iconBg: 'rgba(255,255,255,.1)', iconColor: '#e8eaee' },
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAssetIcon(ticker) {
  const key = (ticker ?? '').toUpperCase();
  if (KNOWN_ICONS[key]) return KNOWN_ICONS[key];
  const palette = FALLBACK_PALETTE[hashString(key) % FALLBACK_PALETTE.length];
  return { ...palette, iconLabel: key.slice(0, 2) || '??' };
}
