import { useMemo } from 'react';
import { formatMoney } from '../utils/finance.js';

const WIDTH = 700;
const HEIGHT = 220;
const PAD_X = 12;
const PAD_TOP = 20;
const PAD_BOTTOM = 20;

function formatShortDate(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function PortfolioChart({ history, currency }) {
  const points = useMemo(() => {
    const field = currency === 'USD' ? 'total_usd' : 'total_ars';
    return history
      .filter((h) => h[field] != null)
      .map((h) => ({ date: h.snapshot_date, value: Number(h[field]) }));
  }, [history, currency]);

  if (points.length < 2) {
    return (
      <div className="chart-card">
        <div className="table-header">
          <div className="table-title">Evolución de la cartera</div>
        </div>
        <div
          style={{
            padding: '40px 18px',
            textAlign: 'center',
            color: 'var(--text-faint)',
            fontSize: 13,
          }}
        >
          Todavía no hay suficiente historial — volvé mañana para ver la evolución.
        </div>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerW = WIDTH - PAD_X * 2;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const coords = points.map((p, i) => {
    const x = PAD_X + (i / (points.length - 1)) * innerW;
    const y = PAD_TOP + innerH - ((p.value - min) / range) * innerH;
    return [x, y];
  });

  const linePath = coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const floorY = (PAD_TOP + innerH).toFixed(1);
  const areaPath =
    `M${coords[0][0].toFixed(1)},${floorY} ` +
    coords.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') +
    ` L${coords[coords.length - 1][0].toFixed(1)},${floorY} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const changePct = first.value ? ((last.value - first.value) / Math.abs(first.value)) * 100 : 0;
  const positive = changePct >= 0;
  const lastCoord = coords[coords.length - 1];

  return (
    <div className="chart-card">
      <div className="table-header">
        <div className="table-title">Evolución de la cartera</div>
        <div className={'chart-change ' + (positive ? 'positive' : 'negative')}>
          {(positive ? '+' : '') + changePct.toFixed(1).replace('.', ',')}% desde el{' '}
          {formatShortDate(first.date)}
        </div>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 220, display: 'block' }}>
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b8e34a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#b8e34a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#chartFill)" />
        <path d={linePath} fill="none" stroke="#b8e34a" strokeWidth="2" />
        <circle cx={lastCoord[0]} cy={lastCoord[1]} r="4" fill="#b8e34a" />
      </svg>
      <div className="chart-footer">
        <span>{formatShortDate(first.date)}</span>
        <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>
          {formatMoney(last.value, currency)}
        </span>
        <span>{formatShortDate(last.date)}</span>
      </div>
    </div>
  );
}
