import AssetIcon from './AssetIcon.jsx';
import {
  assetValueARS,
  assetGainARS,
  assetGainPct,
  convertAmount,
  formatMoney,
  formatPct,
  formatQty,
} from '../utils/finance.js';

export default function AssetDetailModal({ asset, accounts, currency, usdArs, onClose, onDelete }) {
  const account = accounts.find((a) => a.id === asset.accountId);
  const isFund = asset.kind === 'fund';
  const assetCurrency = asset.currency === 'USD' ? 'USD' : 'ARS';

  const valueARS = assetValueARS(asset, usdArs);
  const gainARS = assetGainARS(asset, usdArs);
  const pct = assetGainPct(asset, usdArs);
  const conv = (v) => (currency === 'USD' ? v / usdArs : v);

  const movements = asset.history.slice().reverse();

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AssetIcon asset={asset} accountName={account?.name} size={36} />
            <div>
              <div className="modal-title">
                {asset.ticker}
                <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: 14 }}>
                  {' '}
                  — {asset.name}
                </span>
              </div>
              <div className="modal-step">{account?.name ?? '—'}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="mini-grid">
            <div className="mini-card">
              <div className="mini-label">{isFund ? 'Saldo' : 'Cantidad'}</div>
              <div className="mini-value">
                {isFund ? formatMoney(conv(asset.value), currency) : formatQty(asset.qty)}
              </div>
            </div>
            <div className="mini-card">
              <div className="mini-label">{isFund ? 'TNA' : 'PPC'}</div>
              <div className="mini-value">
                {isFund
                  ? `${String(asset.tna).replace('.', ',')}%`
                  : formatMoney(convertAmount(asset.avgPrice, assetCurrency, currency, usdArs), currency)}
              </div>
            </div>
            <div className="mini-card">
              <div className="mini-label">Valor actual</div>
              <div className="mini-value">{formatMoney(conv(valueARS), currency)}</div>
            </div>
            <div className="mini-card">
              <div className="mini-label">Gan. / Pérd.</div>
              <div className={'mini-value ' + (gainARS >= 0 ? 'positive' : 'negative')}>
                {(gainARS >= 0 ? '+' : '−') + formatMoney(conv(Math.abs(gainARS)), currency)}
                {!isFund && ` (${formatPct(pct)})`}
              </div>
            </div>
          </div>

          <div>
            <div className="summary-eyebrow" style={{ marginBottom: 10 }}>
              Movimientos
            </div>
            {movements.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
                Sin movimientos registrados.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {movements.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      padding: '9px 2px',
                      borderBottom:
                        i < movements.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                      font: "500 13px 'IBM Plex Mono', monospace",
                    }}
                  >
                    <span style={{ color: 'var(--text-dim)' }}>{h.date}</span>
                    {isFund ? (
                      <span>Depósito · {formatMoney(h.qty, 'ARS')}</span>
                    ) : (
                      <span>
                        Compra · {formatQty(h.qty)} × {formatMoney(h.price, assetCurrency)}
                        <span style={{ color: 'var(--text-faint)' }}>
                          {' '}
                          = {formatMoney(h.qty * h.price, assetCurrency)}
                        </span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn-danger"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              if (window.confirm(`¿Eliminar ${asset.ticker}? Esto también borra su historial.`)) {
                onDelete(asset.id);
              }
            }}
          >
            Eliminar activo
          </button>
        </div>
      </div>
    </div>
  );
}
