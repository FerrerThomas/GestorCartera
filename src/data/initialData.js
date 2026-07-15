export const ACCOUNT_TYPES = {
  broker: {
    label: 'Broker',
    description: 'Acciones, CEDEARs y bonos. Ej: Balanz, IOL, PPI.',
  },
  billetera: {
    label: 'Billetera virtual',
    description: 'Saldo y FCI. Ej: Mercado Pago, Ualá, Personal Pay.',
  },
  exchange: {
    label: 'Exchange cripto',
    description: 'BTC, ETH, stablecoins. Ej: Binance, Lemon, Ripio.',
  },
  efectivo: {
    label: 'Efectivo',
    description: 'Pesos o dólares fuera del sistema.',
  },
  steam: {
    label: 'Steam / Skins CS2',
    description: 'Skins de Counter-Strike 2 valuadas a precio de mercado (Skinport).',
  },
};

export const ACCOUNT_DOT_COLOR = {
  broker: '#b8e34a',
  billetera: '#37c1f2',
  exchange: '#f2a137',
  efectivo: '#8a93a6',
  steam: '#a897ff',
};
