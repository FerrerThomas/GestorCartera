import { useMemo, useState } from 'react';
import AssetIcon from '../components/AssetIcon.jsx';
import Icon from '../components/glass/Icon.jsx';
import { Segmented, Sparkline } from '../components/glass/ui.jsx';
import { formatPrice, nativeCurrency } from '../components/glass/AssetDetailSheet.jsx';
import {
  assetGainARS,
  assetGainPct,
  assetInvestedARS,
  assetValueARS,
  formatMoney,
  formatPct,
  formatQty,
} from '../utils/finance.js';

const RANGES = [
  { value: '7', label: '1S' },
  { value: '30', label: '1M' },
  { value: '90', label: '3M' },
  { value: '365', label: '1A' },
  { value: 'all', label: 'Todo' },
];
const RANGE_CAPTION = { 7: 'en la semana', 30: 'en el mes', 90: 'en 3 meses', 365: 'en el año', all: 'desde el inicio' };

const CATEGORY_LABEL = {
  Acción: 'Acciones',
  CEDEAR: 'CEDEAR',
  Cripto: 'Cripto',
  'Fondo money market': 'Billeteras',
  Efectivo: 'Efectivo',
  'Skin CS2': 'Skins',
};

export default function CarteraScreen({
  assets,
  accounts,
  currency,
  usdArs,
  history,
  totalARS,
  accountFilter,
  onClearAccount,
  onSelectAsset,
  onAddAsset,
}) {
  const [range, setRange] = useState('90');
  const [cat, setCat] = useState('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const conv = (v) => (currency === 'USD' ? v / usdArs : v);
  const accountName = (id) => accounts.find((a) => a.id === id)?.name ?? '—';
  const filterAccount = accounts.find((a) => a.id === accountFilter);

  const scoped = assets.filter((a) => !accountFilter || a.accountId === accountFilter);
  const categoriesPresent = [...new Set(scoped.map((a) => a.category))];
  const rows = scoped
    .filter((a) => cat === 'all' || a.category === cat)
    .filter((a) => {
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    })
    .sort((a, b) => assetValueARS(b, usdArs) - assetValueARS(a, usdArs));

  const value = rows.reduce((s, a) => s + assetValueARS(a, usdArs), 0);
  const invested = rows.reduce((s, a) => s + assetInvestedARS(a, usdArs), 0);
  const gain = rows.reduce((s, a) => s + assetGainARS(a, usdArs), 0);
  const gainPct = invested ? (gain / invested) * 100 : 0;

  const series = useMemo(() => {
    const cutoff = range === 'all' ? null : new Date(Date.now() - Number(range) * 86400000).toISOString().slice(0, 10);
    const pts = history
      .filter((h) => !cutoff || h.snapshot_date >= cutoff)
      .map((h) => (currency === 'USD' ? Number(h.total_usd ?? h.total_ars / usdArs) : Number(h.total_ars)));
    pts.push(currency === 'USD' ? totalARS / usdArs : totalARS);
    return pts;
  }, [history, range, currency, usdArs, totalARS]);
  const rangeDelta = series.length > 1 ? series[series.length - 1] - series[0] : null;

  return (
    <div className="screen">
      <section className="hero" style={{ '--hero': 'var(--hero-cartera)' }} aria-label="Rendimiento">
        <header className="hero-head" style={{ marginBottom: 12 }}>
          <h1 className="large-title">Cartera</h1>
          <div className="btn-group glass clear">
            <button
              type="button"
              className="icon-btn"
              aria-label="Buscar activo"
              aria-pressed={searching}
              onClick={() => {
                setSearching((v) => !v);
                setQuery('');
              }}
            >
              <Icon name="search" size={19} stroke={2.2} />
            </button>
            <button type="button" className="icon-btn" aria-label="Agregar activo" onClick={onAddAsset}>
              <Icon name="plus" size={20} stroke={2.3} />
            </button>
          </div>
        </header>
        <span className="hero-label" style={{ color: '#c7c7cc' }}>
          {filterAccount ? `Valor en ${filterAccount.name}` : 'Valor de la cartera'}
        </span>
        <span className="hero-big" style={{ fontSize: 38, lineHeight: '46px' }}>
          {formatMoney(conv(value), currency)}
        </span>
        <span className="hero-sub" style={{ color: gain >= 0 ? '#30d158' : '#ff6961' }}>
          {(gain >= 0 ? '+' : '−') + formatMoney(Math.abs(conv(gain)), currency)} ({formatPct(gainPct)}){' '}
          <span className="muted" style={{ color: '#c7c7cc' }}>
            de ganancia
          </span>
        </span>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#c7c7cc' }}>
            Patrimonio total
            {rangeDelta != null && (
              <>
                {' · '}
                <span style={{ color: rangeDelta >= 0 ? '#30d158' : '#ff6961', fontWeight: 600 }}>
                  {(rangeDelta >= 0 ? '+' : '−') + formatMoney(Math.abs(rangeDelta), currency)}
                </span>{' '}
                {RANGE_CAPTION[range]}
              </>
            )}
          </span>
          {series.length > 1 ? (
            <Sparkline values={series} height={110} color={rangeDelta >= 0 ? '#30d158' : '#ff6961'} fillOpacity={0.16} label="Evolución del patrimonio" />
          ) : (
            <div style={{ height: 110, display: 'grid', placeItems: 'center', fontSize: 13, color: '#c7c7cc' }}>
              El gráfico se arma con una foto por día
            </div>
          )}
        </div>
        <Segmented
          label="Período"
          className="on-hero"
          glass="glass clear"
          value={range}
          onChange={setRange}
          options={RANGES}
        />
      </section>

      <div className="content">
        {searching && (
          <input
            className="text-input"
            type="search"
            placeholder="Buscar por ticker o nombre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="Buscar activo"
          />
        )}
        <div className="chips" role="group" aria-label="Filtrar por categoría">
          {filterAccount && (
            <button type="button" className="chip-glass glass tint" onClick={onClearAccount} aria-label={`Quitar filtro ${filterAccount.name}`}>
              {filterAccount.name} ✕
            </button>
          )}
          {[{ id: 'all', label: 'Todo' }, ...categoriesPresent.map((c) => ({ id: c, label: CATEGORY_LABEL[c] ?? c }))].map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip-glass glass${cat === c.id ? ' tint' : ''}`}
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="card empty">
            {assets.length === 0 ? 'Todavía no cargaste activos.' : 'No hay activos con ese filtro.'}
            <div>
              <button type="button" className="capsule-btn plain" style={{ marginTop: 12 }} onClick={onAddAsset}>
                Agregar activo
              </button>
            </div>
          </div>
        ) : (
          <>
          <div className="holdings-head desk-only" aria-hidden="true">
            <span>Activo</span>
            <span className="col">Cantidad</span>
            <span className="col optional">Precio promedio</span>
            <span className="col optional">Precio actual</span>
            <span className="col" style={{ width: 150 }}>Valor</span>
          </div>
          <ul className="list">
            {rows.map((a) => {
              const pct = assetGainPct(a, usdArs);
              const sub =
                a.kind === 'fund'
                  ? `${accountName(a.accountId)} · TNA ${String(a.tna ?? 0).replace('.', ',')}%`
                  : `${a.name !== a.ticker ? a.name + ' · ' : ''}${formatQty(a.qty ?? 0)} · ${accountName(a.accountId)}`;
              return (
                <li key={a.id}>
                  <button type="button" className="row" onClick={() => onSelectAsset(a)} style={{ minHeight: 62 }}>
                    <AssetIcon asset={a} accountName={accountName(a.accountId)} size={40} />
                    <span className="row-body">
                      <span className="row-main">
                        <span className="row-title strong">{a.ticker}</span>
                        <span className="row-sub">{sub}</span>
                      </span>
                      {a.kind !== 'fund' ? (
                        <>
                          <span className="col desk-only">{formatQty(a.qty ?? 0)}</span>
                          <span className="col optional desk-only">{formatPrice(a.avgPrice ?? 0, nativeCurrency(a))}</span>
                          <span className="col optional desk-only">{formatPrice(a.currentPrice ?? 0, nativeCurrency(a))}</span>
                        </>
                      ) : (
                        <>
                          <span className="col desk-only">—</span>
                          <span className="col optional desk-only">TNA {String(a.tna ?? 0).replace('.', ',')}%</span>
                          <span className="col optional desk-only">—</span>
                        </>
                      )}
                      <span className="row-values val-col">
                        <span className="row-value">{formatMoney(conv(assetValueARS(a, usdArs)), currency)}</span>
                        <span className={`pill ${Math.abs(pct) < 0.05 ? 'flat' : pct > 0 ? 'up' : 'down'}`}>{formatPct(pct)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </div>
    </div>
  );
}
