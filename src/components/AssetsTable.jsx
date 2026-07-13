import {
  assetValueARS,
  assetGainARS,
  assetGainPct,
  formatMoney,
  formatQty,
  formatPct,
  USD_ARS,
} from '../utils/finance.js';

export default function AssetsTable({ assets, accounts, currency, onAddAsset }) {
  const accountName = (id) => accounts.find((a) => a.id === id)?.name ?? '';
  const conv = (v) => (currency === 'USD' ? v / USD_ARS : v);

  return (
    <div className="table-card">
      <div className="table-header">
        <div className="table-title">Mis activos</div>
        <button className="btn-primary" onClick={onAddAsset}>
          + Agregar activo
        </button>
      </div>

      <div className="grid-row head">
        <div>Activo</div>
        <div className="text-right">Cantidad</div>
        <div className="text-right">P. compra</div>
        <div className="text-right">P. actual</div>
        <div className="text-right">Valor</div>
        <div className="text-right">Gan. / Pérd.</div>
      </div>

      {assets.map((asset) => {
        const isFund = asset.kind === 'fund';
        const valueARS = assetValueARS(asset);
        const gainARS = assetGainARS(asset);
        const pct = assetGainPct(asset);
        const priceCurrency = asset.currency === 'USD' ? 'USD' : 'ARS';

        return (
          <div className="grid-row" key={asset.id}>
            <div className="asset-name-cell">
              <span
                className="asset-icon"
                style={{ background: asset.iconBg, color: asset.iconColor }}
              >
                {asset.iconLabel}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="asset-ticker">{asset.ticker}</span>
                <span className="asset-sub">
                  {asset.name} · {accountName(asset.accountId)}
                </span>
              </span>
            </div>
            <div className="text-right">{isFund ? '—' : formatQty(asset.qty)}</div>
            <div className="text-right dim">
              {isFund ? '—' : formatMoney(asset.avgPrice, priceCurrency)}
            </div>
            <div className="text-right">
              {isFund ? `${asset.tna}% TNA` : formatMoney(asset.currentPrice, priceCurrency)}
            </div>
            <div className="text-right">{formatMoney(conv(valueARS), currency)}</div>
            <div className={'text-right ' + (gainARS >= 0 ? 'positive' : 'negative')}>
              {isFund
                ? (gainARS >= 0 ? '+' : '−') + formatMoney(conv(Math.abs(gainARS)), currency)
                : formatPct(pct)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
