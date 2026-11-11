// Íconos de trazo (24×24) y el estilo visual de cada categoría.

const PATHS = {
  home: 'M4 11l8-7 8 7v9H4zM10 20v-5h4v5',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  pie: 'M12 3.5V12h8.5M20.5 12A8.5 8.5 0 1 1 12 3.5',
  chart: 'M3 17l5-5 4 3 8-8M15 7h5v5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M6 12h12',
  swap: 'M5 9h13l-3.5-3.5M19 15H6l3.5 3.5',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M8 10l4 4 4-4',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l4.5 4.5',
  filter: 'M4 7h16M7 12h10M10 17h4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  warning: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  logout: 'M15 4h4v16h-4M10 16l-4-4 4-4M6 12h10',
  wallet: 'M3 7h18v13H3zM3 7l3-4h12l3 4M16 13.5h.01',
  // Categorías
  cart: 'M3 4h2l2.4 10.2h10.1L20 8H6.2M9 19.5h.01M17 19.5h.01',
  food: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2.5 5-2.5 8h2.5v10',
  car: 'M5 17h14M6 17v2M18 17v2M4 13l2-6h12l2 6v4H4zM7.5 14h.01M16.5 14h.01',
  glass: 'M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v8M8.5 21h7',
  tv: 'M3 6h18v11H3zM8 21h8M12 17v4',
  health: 'M12 5v14M5 12h14',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  briefcase: 'M3 8h18v12H3zM9 8V5h6v3M3 13h18',
  laptop: 'M5 6h14v9H5zM3 18h18',
  gift: 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13',
};

export default function Icon({ name, size = 20, stroke = 2, color = 'currentColor', label, style }) {
  const d = PATHS[name] ?? PATHS.dots;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      style={style}
    >
      <path d={d} />
    </svg>
  );
}

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// Categorías por defecto → ícono y color. Las que crea el usuario usan su emoji.
const CATEGORY_STYLE = {
  supermercado: { icon: 'cart', color: '#FF9500' },
  comida: { icon: 'food', color: '#FF6B3D' },
  transporte: { icon: 'car', color: '#0A84FF' },
  hogar: { icon: 'home', color: '#30B0C7' },
  servicios: { icon: 'bolt', color: '#E0A100' },
  salidas: { icon: 'glass', color: '#AF52DE' },
  compras: { icon: 'bag', color: '#FF2D55' },
  salud: { icon: 'health', color: '#FF3B30' },
  suscripciones: { icon: 'tv', color: '#D63384' },
  otros: { icon: 'dots', color: '#8E8E93' },
  sueldo: { icon: 'briefcase', color: '#34C759' },
  freelance: { icon: 'laptop', color: '#5856D6' },
  'otros ingresos': { icon: 'gift', color: '#8E8E93' },
};
const FALLBACK_COLORS = ['#5856D6', '#30B0C7', '#FF9500', '#AF52DE', '#0A84FF', '#34C759', '#FF2D55'];

export function categoryStyle(category) {
  if (!category) return { icon: 'dots', color: '#8E8E93', emoji: null };
  const known = CATEGORY_STYLE[norm(category.name)];
  if (known) return { ...known, emoji: null };
  let h = 0;
  for (const ch of category.name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { icon: null, emoji: category.emoji || category.name?.[0]?.toUpperCase() || '•', color: FALLBACK_COLORS[h % FALLBACK_COLORS.length] };
}

export function CategoryDot({ category, size = 38, iconSize }) {
  const st = categoryStyle(category);
  return (
    <span
      className="dot-icon"
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: size / 2, background: st.color, fontSize: size * 0.45 }}
    >
      {st.icon ? <Icon name={st.icon} size={iconSize ?? Math.round(size * 0.5)} stroke={2.1} /> : st.emoji}
    </span>
  );
}

const ACCOUNT_COLORS = {
  broker: '#5856D6',
  billetera: '#0A84FF',
  exchange: '#E0A100',
  efectivo: '#34C759',
  steam: '#3A3A3C',
};
const ACCOUNT_TYPE_LABEL = {
  broker: 'Broker',
  billetera: 'Billetera',
  exchange: 'Exchange',
  efectivo: 'Efectivo',
  steam: 'Steam',
};
export function accountColor(account) {
  return ACCOUNT_COLORS[account?.type] ?? '#8E8E93';
}
export function accountTypeLabel(account) {
  return ACCOUNT_TYPE_LABEL[account?.type] ?? 'Cuenta';
}
