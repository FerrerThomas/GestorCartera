// Logos sin base de datos: las cripto vienen del paquete cryptocurrency-icons
// (jsDelivr) y todo lo demás del servicio de favicons de Google sobre un mapa
// curado ticker/marca → dominio. Lo desconocido devuelve null y la UI muestra
// las iniciales.

const CRYPTO_ICON_BASE = 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@0.18.1/svg/color';

export const faviconUrl = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// ---------------------------------------------------------------------------
// Acciones argentinas, CEDEARs y ETFs → dominio de la empresa / emisor
// ---------------------------------------------------------------------------
const TICKER_DOMAINS = {
  // Panel líder y general (BYMA)
  GGAL: 'bancogalicia.com',
  YPFD: 'ypf.com',
  YPF: 'ypf.com',
  PAMP: 'pampaenergia.com',
  TXAR: 'ternium.com',
  ALUA: 'aluar.com.ar',
  BMA: 'macro.com.ar',
  BBAR: 'bbva.com.ar',
  SUPV: 'www.supervielle.com.ar',
  CEPU: 'centralpuerto.com',
  TGSU2: 'tgs.com',
  TGNO4: 'www.tgn.com.ar',
  EDN: 'edenor.com',
  LOMA: 'lomanegra.com',
  CRES: 'www.cresud.com.ar',
  IRSA: 'www.irsa.com.ar',
  MIRG: 'mirgor.com.ar',
  TECO2: 'telecom.com.ar',
  BYMA: 'byma.com.ar',
  METR: 'metrogas.com.ar',
  TRAN: 'transener.com.ar',
  CVH: 'cablevisionholding.com',
  HARG: 'holcim.com.ar',
  MOLI: 'molinos.com.ar',
  VALO: 'www.bancodevalores.com',
  // CEDEARs más operados
  MELI: 'mercadolibre.com',
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  GOOGL: 'google.com',
  GOOG: 'google.com',
  AMZN: 'amazon.com',
  TSLA: 'tesla.com',
  NVDA: 'nvidia.com',
  META: 'meta.com',
  KO: 'coca-cola.com',
  PEP: 'pepsico.com',
  DIS: 'disney.com',
  NFLX: 'netflix.com',
  AMD: 'amd.com',
  INTC: 'intel.com',
  IBM: 'ibm.com',
  ORCL: 'oracle.com',
  CSCO: 'cisco.com',
  ADBE: 'adobe.com',
  CRM: 'salesforce.com',
  QCOM: 'qualcomm.com',
  AVGO: 'broadcom.com',
  TSM: 'tsmc.com',
  PYPL: 'paypal.com',
  V: 'visa.com',
  MA: 'mastercard.com',
  JPM: 'jpmorganchase.com',
  BAC: 'bankofamerica.com',
  C: 'citigroup.com',
  GS: 'goldmansachs.com',
  WFC: 'wellsfargo.com',
  WMT: 'walmart.com',
  COST: 'costco.com',
  MCD: 'mcdonalds.com',
  SBUX: 'starbucks.com',
  NKE: 'nike.com',
  PG: 'pg.com',
  JNJ: 'jnj.com',
  PFE: 'pfizer.com',
  MRNA: 'modernatx.com',
  ABBV: 'abbvie.com',
  LLY: 'lilly.com',
  XOM: 'exxonmobil.com',
  CVX: 'chevron.com',
  BA: 'boeing.com',
  CAT: 'caterpillar.com',
  MMM: '3m.com',
  GE: 'ge.com',
  F: 'ford.com',
  GM: 'gm.com',
  T: 'att.com',
  VZ: 'verizon.com',
  UBER: 'uber.com',
  ABNB: 'airbnb.com',
  SHOP: 'shopify.com',
  SPOT: 'spotify.com',
  SNAP: 'snap.com',
  PINS: 'pinterest.com',
  COIN: 'coinbase.com',
  MSTR: 'strategy.com',
  PLTR: 'palantir.com',
  BABA: 'alibaba.com',
  JD: 'global.jd.com',
  BIDU: 'baidu.com',
  NIO: 'nio.com',
  PBR: 'petrobras.com.br',
  VALE: 'vale.com',
  ITUB: 'itau.com.br',
  BBD: 'bradesco.com.br',
  NU: 'nubank.com.br',
  GLOB: 'globant.com',
  DESP: 'despegar.com.ar',
  VIST: 'vistaenergy.com',
  ARCO: 'arcosdorados.com',
  // ETFs (CEDEARs)
  SPY: 'ssga.com',
  DIA: 'ssga.com',
  XLE: 'ssga.com',
  XLF: 'ssga.com',
  GLD: 'spdrgoldshares.com',
  QQQ: 'invesco.com',
  IWM: 'ishares.com',
  EEM: 'ishares.com',
  EWZ: 'ishares.com',
  SLV: 'ishares.com',
  ARKK: 'ark-funds.com',
};

// ---------------------------------------------------------------------------
// Marcas de cuentas: billeteras, bancos, brokers y exchanges.
// `match` contra el nombre que el usuario le puso a la cuenta (sin tildes ni
// mayúsculas), así "CocosCapital", "Cuanta Dni" o "Bco Galicia" también andan.
// ---------------------------------------------------------------------------
export const BRANDS = [
  // Billeteras
  { name: 'Mercado Pago', domain: 'mercadopago.com.ar', match: /mercado ?pago|^mp$/, kind: 'billetera' },
  { name: 'Cuenta DNI', domain: 'bancoprovincia.com.ar', match: /cu[ae]n?ta ?dni|\bdni\b|provincia|bapro/, kind: 'billetera' },
  { name: 'Ualá', domain: 'uala.com.ar', match: /uala/, kind: 'billetera' },
  { name: 'Naranja X', domain: 'naranjax.com', match: /naranja/, kind: 'billetera' },
  { name: 'Personal Pay', domain: 'personal.com.ar', match: /personal ?pay|^personal$/, kind: 'billetera' },
  { name: 'Brubank', domain: 'brubank.com', match: /brubank/, kind: 'billetera' },
  { name: 'MODO', domain: 'modo.com.ar', match: /\bmodo\b/, kind: 'billetera' },
  { name: 'BNA+', domain: 'bna.com.ar', match: /\bbna\b|banco nacion|bna ?\+/, kind: 'billetera' },
  { name: 'Prex', domain: 'prexcard.com', match: /\bprex\b/, kind: 'billetera' },
  { name: 'Lemon', domain: 'lemon.me', match: /lemon/, kind: 'exchange' },
  { name: 'Belo', domain: 'belo.app', match: /\bbelo\b/, kind: 'exchange' },
  { name: 'Letsbit', domain: 'letsbit.io', match: /letsbit/, kind: 'exchange' },
  { name: 'Fiwind', domain: 'fiwind.io', match: /fiwind/, kind: 'exchange' },
  // Bancos
  { name: 'Galicia', domain: 'bancogalicia.com', match: /galicia/, kind: 'banco' },
  { name: 'Santander', domain: 'santander.com.ar', match: /santander/, kind: 'banco' },
  { name: 'BBVA', domain: 'bbva.com.ar', match: /bbva|frances/, kind: 'banco' },
  { name: 'Macro', domain: 'macro.com.ar', match: /\bmacro\b/, kind: 'banco' },
  { name: 'ICBC', domain: 'icbc.com', match: /icbc/, kind: 'banco' },
  { name: 'Supervielle', domain: 'www.supervielle.com.ar', match: /supervielle/, kind: 'banco' },
  { name: 'Banco Ciudad', domain: 'bancociudad.com.ar', match: /ciudad/, kind: 'banco' },
  { name: 'Hipotecario', domain: 'hipotecario.com.ar', match: /hipotecario/, kind: 'banco' },
  // Brokers
  { name: 'IOL', domain: 'invertironline.com', match: /\biol\b|invertir ?online/, kind: 'broker' },
  { name: 'Cocos', domain: 'cocos.capital', match: /cocos/, kind: 'broker' },
  { name: 'Balanz', domain: 'balanz.com', match: /balanz/, kind: 'broker' },
  { name: 'PPI', domain: 'portfoliopersonal.com', match: /\bppi\b|portfolio ?personal/, kind: 'broker' },
  { name: 'Bull Market', domain: 'bullmarketbrokers.com', match: /bull ?market/, kind: 'broker' },
  { name: 'Allaria', domain: 'allaria.com.ar', match: /allaria/, kind: 'broker' },
  { name: 'Interactive Brokers', domain: 'interactivebrokers.com', match: /interactive|ibkr/, kind: 'broker' },
  // Exchanges
  { name: 'Binance', domain: 'binance.com', match: /binance/, kind: 'exchange' },
  { name: 'Ripio', domain: 'ripio.com', match: /ripio/, kind: 'exchange' },
  { name: 'Buenbit', domain: 'buenbit.com', match: /buenbit/, kind: 'exchange' },
  { name: 'Bitso', domain: 'bitso.com', match: /bitso/, kind: 'exchange' },
  { name: 'SatoshiTango', domain: 'satoshitango.com', match: /satoshi/, kind: 'exchange' },
  { name: 'Coinbase', domain: 'coinbase.com', match: /coinbase/, kind: 'exchange' },
  { name: 'Kraken', domain: 'kraken.com', match: /kraken/, kind: 'exchange' },
  // Otros
  { name: 'Steam', domain: 'steampowered.com', match: /steam/, kind: 'steam' },
];

export function findBrand(accountName) {
  const n = norm(accountName);
  if (!n) return null;
  return BRANDS.find((b) => b.match.test(n)) ?? null;
}

export function getAccountLogoUrl(accountName) {
  const b = findBrand(accountName);
  return b ? faviconUrl(b.domain) : null;
}

// Presets al crear una cuenta, por tipo, con la marca y cómo rinde (billeteras):
//   fci: fondo money market donde invierte el saldo remunerado → el saldo se
//        sigue por cuotapartes, igual que el fondo real.
//   api: entidad con tasa publicada en ArgentinaDatos → TNA automática.
//   sin ninguna: TNA manual (cuentas remuneradas con tasa fija, o sin interés).
export const POPULAR_WALLETS = [
  { name: 'Mercado Pago', fci: 'Mercado Fondo - Clase A' },
  { name: 'Ualá', fci: 'Ualintec Ahorro Pesos - Clase A' },
  { name: 'Personal Pay', fci: 'Delta Pesos - Clase A' },
  { name: 'Cocos', fci: 'Cocos Ahorro - Clase A' },
  { name: 'Balanz', fci: 'Balanz Capital Money Market - Clase A' },
  { name: 'Letsbit', api: 'letsbit' },
  { name: 'Fiwind', api: 'fiwind' },
  { name: 'Naranja X' },
  { name: 'Cuenta DNI' },
  { name: 'Brubank' },
  { name: 'MODO' },
  { name: 'BNA+' },
  { name: 'Prex' },
  { name: 'Lemon' },
  { name: 'Belo' },
];
export const POPULAR_BROKERS = ['IOL', 'Cocos', 'Balanz', 'PPI', 'Bull Market', 'Allaria', 'Galicia', 'Santander'].map((name) => ({ name }));
export const POPULAR_EXCHANGES = ['Binance', 'Lemon', 'Ripio', 'Belo', 'Buenbit', 'Bitso', 'Letsbit', 'Fiwind'].map((name) => ({ name }));

// Preset de billetera (con su fondo) para un nombre de cuenta, aunque esté
// escrito distinto ("mercadopago", "MP", "Cuanta Dni").
export function findWallet(walletName) {
  const brand = findBrand(walletName);
  if (!brand) return null;
  return POPULAR_WALLETS.find((w) => w.name === brand.name) ?? null;
}

export const getWalletLogoUrl = getAccountLogoUrl;

// Logo de un activo. `accountName` solo se usa para las billeteras (SALDO),
// que llevan el logo de la billetera.
export function getAssetLogoUrl(asset, accountName) {
  if (asset.kind === 'fund') return getAccountLogoUrl(accountName);
  if (asset.category === 'Cripto') {
    return `${CRYPTO_ICON_BASE}/${asset.ticker.toLowerCase()}.svg`;
  }
  if (asset.category === 'Efectivo') return null;
  const t = String(asset.ticker ?? '').toUpperCase();
  // Algunos CEDEARs cotizan con sufijo de moneda (AAPLD, MELIC): probar sin él.
  const domain = TICKER_DOMAINS[t] ?? TICKER_DOMAINS[t.replace(/[DC]$/, '')];
  return domain ? faviconUrl(domain) : null;
}
