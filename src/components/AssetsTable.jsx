import AssetIcon from './AssetIcon.jsx';
import {
  assetValueARS,
  assetGainARS,
  assetGainPct,
  convertAmount,
  formatMoney,
  formatQty,
  formatPct,
} from '../utils/finance.js';

export default function AssetsTable({ assets, accounts, currency, usdArs, onAddAsset, onSelectAsset }) {
  const accountName = (id) => accounts.find((a) => a.id === id)?.name ?? '';
  const conv = (v) => (currency === 'USD' ? v / usdArs : v);

  return (
    <div className="table-card">
      <div className="table-header">
        <div className="table-title">Mis activos</div>
        <button className="btn-primary" onClick={onAddAsset}>
          + Agregar activo
        </button>
      </div>

      {assets.length === 0 ? (
        <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
          No tenés activos todavía — agregá tu primera operación.
        </div>
      ) : (
        <>
      {/* Vista móvil: tarjetas (misma data, mismo onSelectAsset). Desktop la oculta por CSS. */}
      <div className="asset-cards">
        {assets.map((asset) => {
          const isFund = asset.kind === 'fund';
          const valueARS = assetValueARS(asset, usdArs);
          const gainARS = assetGainARS(asset, usdArs);
          const pct = assetGainPct(asset, usdArs);
          const gainDisplay = conv(gainARS);
          return (
            <div className="asset-card" key={asset.id} onClick={() => onSelectAsset?.(asset)}>
              <AssetIcon asset={asset} accountName={accountName(asset.accountId)} />
              <div className="asset-card-info">
                <span className="asset-ticker">{asset.ticker}</span>
                <span className="asset-sub">
                  {isFund ? `${asset.tna}% TNA` : formatQty(asset.qty)} · {accountName(asset.accountId)}
                </span>
              </div>
              <div className="asset-card-value">
                <span className="mono">{formatMoney(conv(valueARS), currency)}</span>
                <span className={'asset-card-gain ' + (gainARS >= 0 ? 'positive' : 'negative')}>
                  {formatPct(pct)} · {(gainDisplay >= 0 ? '+' : '−') + formatMoney(Math.abs(gainDisplay), currency)}
                </span>
              </div>
            </div>
          );
        })}
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
        const valueARS = assetValueARS(asset, usdArs);
        const gainARS = assetGainARS(asset, usdArs);
        const pct = assetGainPct(asset, usdArs);
        const gainDisplay = conv(gainARS);
        const assetPriceCurrency = asset.currency === 'USD' ? 'USD' : 'ARS';

        return (
          <div
            className="grid-row clickable"
            key={asset.id}
            onClick={() => onSelectAsset?.(asset)}
            title={`Ver movimientos de ${asset.ticker}`}
          >
            <div className="asset-name-cell">
              <AssetIcon asset={asset} accountName={accountName(asset.accountId)} />
              <span style={{ minWidth: 0 }}>
                <span className="asset-ticker">{asset.ticker}</span>
                <span className="asset-sub">
                  {asset.name} · {accountName(asset.accountId)}
                </span>
              </span>
            </div>
            <div className="text-right">{isFund ? '—' : formatQty(asset.qty)}</div>
            <div className="text-right dim">
              {isFund
                ? '—'
                : formatMoney(convertAmount(asset.avgPrice, assetPriceCurrency, currency, usdArs), currency)}
            </div>
            <div className="text-right">
              {isFund
                ? `${asset.tna}% TNA`
                : formatMoney(convertAmount(asset.currentPrice, assetPriceCurrency, currency, usdArs), currency)}
            </div>
            <div className="text-right">{formatMoney(conv(valueARS), currency)}</div>
            <div className={'text-right ' + (gainARS >= 0 ? 'positive' : 'negative')}>
              <div>{formatPct(pct)}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                {(gainDisplay >= 0 ? '+' : '−') + formatMoney(Math.abs(gainDisplay), currency)}
              </div>
            </div>
          </div>
        );
      })}
        </>
      )}
    </div>
  );
}
