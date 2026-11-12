// Ícono de respaldo de un activo (cuando no hay logo): se deriva del ticker,
// nunca se guarda en la base. Colores sólidos con texto blanco, estilo iOS.
const KNOWN_ICONS = {
  ARS: { iconBg: '#34C759', iconColor: '#FFFFFF', iconLabel: '$' },
  USD: { iconBg: '#248A3D', iconColor: '#FFFFFF', iconLabel: 'US$' },
  SALDO: { iconBg: '#0A84FF', iconColor: '#FFFFFF', iconLabel: '$' },
  BTC: { iconBg: '#F7931A', iconColor: '#FFFFFF', iconLabel: '₿' },
  ETH: { iconBg: '#627EEA', iconColor: '#FFFFFF', iconLabel: 'Ξ' },
  USDT: { iconBg: '#26A17B', iconColor: '#FFFFFF', iconLabel: '₮' },
};

const FALLBACK_PALETTE = ['#5856D6', '#0A84FF', '#30B0C7', '#FF9500', '#AF52DE', '#FF2D55', '#3A3A3C', '#34C759'];

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
  return {
    iconBg: FALLBACK_PALETTE[hashString(key) % FALLBACK_PALETTE.length],
    iconColor: '#FFFFFF',
    iconLabel: key.replace(/[^A-Z0-9]/g, '').slice(0, 2) || '??',
  };
}
