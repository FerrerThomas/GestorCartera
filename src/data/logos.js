// Curated logo sources. No DB involved: crypto icons come from the
// cryptocurrency-icons package via jsDelivr, everything else uses Google's
// favicon service against a curated ticker/wallet -> domain map.
// Unknown tickers simply return null and the UI falls back to initials.

const CRYPTO_ICON_BASE = 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@0.18.1/svg/color';

const faviconUrl = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

// Acciones / CEDEARs conocidos -> dominio de la empresa
const TICKER_DOMAINS = {
  MELI: 'mercadolibre.com',
  AAPL: 'apple.com',
  GGAL: 'bancogalicia.com',
  YPF: 'ypf.com',
  PAMP: 'pampaenergia.com',
  TXAR: 'ternium.com',
  ALUA: 'aluar.com.ar',
  BMA: 'macro.com.ar',
  BBAR: 'bbva.com.ar',
  SUPV: 'supervielle.com.ar',
  CEPU: 'centralpuerto.com',
  TGSU2: 'tgs.com.ar',
  EDN: 'edenor.com',
  LOMA: 'lomanegra.com',
  MSFT: 'microsoft.com',
  GOOGL: 'google.com',
  AMZN: 'amazon.com',
  TSLA: 'tesla.com',
  NVDA: 'nvidia.com',
  META: 'meta.com',
  KO: 'coca-cola.com',
  DIS: 'disney.com',
  NFLX: 'netflix.com',
};

// Billeteras virtuales populares (elegibles al crear una cuenta billetera)
export const POPULAR_WALLETS = [
  { name: 'Mercado Pago', domain: 'mercadopago.com.ar' },
  { name: 'Ualá', domain: 'uala.com.ar' },
  { name: 'Personal Pay', domain: 'personalpay.com.ar' },
  { name: 'Lemon', domain: 'lemon.me' },
  { name: 'Brubank', domain: 'brubank.com' },
  { name: 'Naranja X', domain: 'naranjax.com' },
];

export function getWalletLogoUrl(walletName) {
  const wallet = POPULAR_WALLETS.find(
    (w) => w.name.toLowerCase() === String(walletName ?? '').trim().toLowerCase()
  );
  return wallet ? faviconUrl(wallet.domain) : null;
}

// Resolves the logo URL for an asset row. `accountName` is only used for
// fund ("Saldo") rows, whose logo is the wallet's.
export function getAssetLogoUrl(asset, accountName) {
  if (asset.kind === 'fund') return getWalletLogoUrl(accountName);
  if (asset.category === 'Cripto') {
    return `${CRYPTO_ICON_BASE}/${asset.ticker.toLowerCase()}.svg`;
  }
  const domain = TICKER_DOMAINS[asset.ticker?.toUpperCase()];
  return domain ? faviconUrl(domain) : null;
}
