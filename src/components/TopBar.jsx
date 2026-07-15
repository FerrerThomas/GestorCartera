import { formatMoney, formatPct } from '../utils/finance.js';

export default function TopBar({ total, invested, hora, currency, onSetCurrency, dolarBlue, onToggleSidebar }) {
  const gain = total - invested;
  const pct = invested ? (gain / invested) * 100 : 0;
  const negative = gain < 0;

  return (
    <div className="topbar">
      <button className="hamburger-btn" onClick={onToggleSidebar} title="Menú" aria-label="Abrir menú">
        ☰
      </button>
      <div>
        <div className="patrimonio-label">
          Patrimonio total
          <span className="live-dot">
            <span className="dot" />
            en vivo · {hora}
          </span>
        </div>
        <div className="patrimonio-total mono">{formatMoney(total, currency)}</div>
        <div className="patrimonio-gain">
          <span className={'gain-abs' + (negative ? ' negative' : '')}>
            {(negative ? '−' : '+') + formatMoney(Math.abs(gain), currency)}
          </span>
          <span className={'gain-pct' + (negative ? ' negative' : '')}>
            {formatPct(pct)}
          </span>
          <span className="gain-caption">ganancia total no realizada</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div className="currency-toggle">
          <button
            className={'chip' + (currency === 'ARS' ? ' on' : '')}
            onClick={() => onSetCurrency('ARS')}
          >
            ARS
          </button>
          <button
            className={'chip' + (currency === 'USD' ? ' on' : '')}
            onClick={() => onSetCurrency('USD')}
          >
            USD
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
          Dólar blue:{' '}
          <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
            {dolarBlue != null ? formatMoney(dolarBlue, 'ARS') : 'cargando…'}
          </span>
        </div>
      </div>
    </div>
  );
}
