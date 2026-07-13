import { formatMoney, formatPct } from '../utils/finance.js';

export default function KpiCards({ invested, bestAsset, liquidity, currency }) {
  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-label">Capital invertido</div>
        <div className="kpi-value mono">{formatMoney(invested, currency)}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Mejor activo del mes</div>
        <div className={'kpi-value mono' + (bestAsset && bestAsset.pct < 0 ? ' negative' : ' positive')}>
          {bestAsset ? `${bestAsset.ticker} ${formatPct(bestAsset.pct)}` : '—'}
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Liquidez disponible</div>
        <div className="kpi-value mono">{formatMoney(liquidity, currency)}</div>
      </div>
    </div>
  );
}
