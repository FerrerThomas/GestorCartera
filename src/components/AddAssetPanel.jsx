import { useMemo, useState } from 'react';
import {
  calcAveragePrice,
  formatMoney,
  formatQty,
  parseLocaleNumber,
  todayDDMMYYYY,
} from '../utils/finance.js';

const CATEGORIES = ['Acción', 'CEDEAR', 'Cripto', 'Fondo money market', 'Efectivo'];

export default function AddAssetPanel({ assets, accounts, onClose, onSubmit }) {
  const purchasable = assets.filter((a) => a.kind !== 'fund');
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [tab, setTab] = useState('compra');
  const [assetId, setAssetId] = useState(purchasable[0]?.id ?? '');
  const [addQty, setAddQty] = useState('');
  const [addPrice, setAddPrice] = useState('');

  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newAccountId, setNewAccountId] = useState(accounts[0]?.id ?? '');

  const asset = purchasable.find((a) => a.id === assetId);
  const account = accounts.find((a) => a.id === asset?.accountId);

  const q = parseLocaleNumber(addQty);
  const p = parseLocaleNumber(addPrice);
  const priceCurrency = mode === 'new' ? 'ARS' : asset?.currency === 'USD' ? 'USD' : 'ARS';

  const calc = useMemo(() => {
    if (mode === 'new') {
      return calcAveragePrice(0, 0, q, p);
    }
    if (!asset) return { newQty: 0, newInvested: 0, newAvgPrice: 0 };
    return calcAveragePrice(asset.qty, asset.avgPrice, q, p);
  }, [mode, asset, q, p]);

  const currentPrice = mode === 'new' ? p : asset?.currentPrice ?? 0;
  const gp = calc.newQty * currentPrice - calc.newInvested;
  const gpPct = calc.newInvested > 0 ? (gp / calc.newInvested) * 100 : 0;
  const opTotal = q * p;

  const canSubmit =
    tab === 'compra' &&
    q > 0 &&
    p > 0 &&
    (mode === 'existing' ? !!asset : newTicker.trim() && newName.trim());

  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'existing') {
      onSubmit({ type: 'existing', assetId, qty: q, price: p });
    } else {
      onSubmit({
        type: 'new',
        qty: q,
        price: p,
        asset: {
          ticker: newTicker.trim().toUpperCase(),
          name: newName.trim(),
          category: newCategory,
          accountId: newAccountId,
          currency: 'ARS',
        },
      });
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Agregar operación</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="asset-panel-crumb">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Cuentas /{' '}
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>
              {mode === 'existing' ? account?.name ?? '—' : accounts.find((a) => a.id === newAccountId)?.name ?? '—'}
            </span>{' '}
            / Agregar operación
          </span>
        </div>

        <div className="asset-panel-body">
          {/* form */}
          <div className="asset-panel-form">
            <div className="tab-row">
              <button
                className={'tab-pill' + (tab === 'compra' ? ' active' : '')}
                onClick={() => setTab('compra')}
              >
                Compra
              </button>
              <button
                className={'tab-pill' + (tab === 'venta' ? ' active' : '')}
                onClick={() => setTab('venta')}
              >
                Venta
              </button>
              <button
                className={'tab-pill' + (tab === 'deposito' ? ' active' : '')}
                onClick={() => setTab('deposito')}
              >
                Depósito de capital
              </button>
            </div>

            {tab !== 'compra' && (
              <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '8px 0' }}>
                Próximamente. Por ahora podés registrar compras.
              </div>
            )}

            {tab === 'compra' && (
              <>
                <label className="field">
                  <span className="field-label">Activo</span>
                  {mode === 'existing' ? (
                    <div className="asset-select-box">
                      {asset && (
                        <span
                          className="asset-icon"
                          style={{ background: asset.iconBg, color: asset.iconColor, width: 26, height: 26 }}
                        >
                          {asset.iconLabel}
                        </span>
                      )}
                      <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                        {purchasable.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.ticker} — {a.name}
                          </option>
                        ))}
                      </select>
                      {asset && <span className="have-qty">ya tenés {formatQty(asset.qty)}</span>}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                      <input
                        placeholder="Ticker"
                        value={newTicker}
                        onChange={(e) => setNewTicker(e.target.value)}
                      />
                      <input
                        placeholder="Nombre"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'existing' ? 'new' : 'existing')}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: 12,
                      padding: 0,
                      marginTop: 2,
                    }}
                  >
                    {mode === 'existing' ? '+ Es un activo nuevo' : '← Elegir un activo existente'}
                  </button>
                </label>

                {mode === 'new' && (
                  <div className="field-grid">
                    <label className="field">
                      <span className="field-label">Categoría</span>
                      <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field-label">Cuenta</span>
                      <select value={newAccountId} onChange={(e) => setNewAccountId(e.target.value)}>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <div className="field-grid">
                  <label className="field">
                    <span className="field-label">Cantidad</span>
                    <input
                      className="mono"
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      Precio de compra ({priceCurrency})
                    </span>
                    <input
                      className="mono"
                      value={addPrice}
                      onChange={(e) => setAddPrice(e.target.value)}
                      placeholder="0"
                    />
                  </label>
                </div>

                <div className="field-grid">
                  <label className="field">
                    <span className="field-label">Fecha</span>
                    <input className="mono" value={todayDDMMYYYY()} readOnly />
                  </label>
                  <label className="field">
                    <span className="field-label">Comisión (opcional)</span>
                    <input className="mono" placeholder="$0" />
                  </label>
                </div>

                <div className="op-total">
                  Total operación: <span>{formatMoney(opTotal, priceCurrency)}</span>
                </div>

                <button className="btn-submit" disabled={!canSubmit} onClick={submit}>
                  Registrar compra
                </button>
              </>
            )}
          </div>

          {/* summary */}
          <div className="asset-panel-summary">
            <div className="summary-eyebrow">
              Posición resultante en {mode === 'existing' ? asset?.ticker ?? '—' : newTicker.toUpperCase() || '—'}
            </div>
            <div className="ppc-card">
              <div className="ppc-label">Precio promedio de compra (PPC)</div>
              <div className="ppc-value">{formatMoney(calc.newAvgPrice, priceCurrency)}</div>
              <div className="ppc-before">
                {mode === 'existing' && asset
                  ? `antes: ${formatMoney(asset.avgPrice, priceCurrency)} · ${formatQty(asset.qty)} nominales`
                  : 'activo nuevo'}
              </div>
            </div>
            <div className="mini-grid">
              <div className="mini-card">
                <div className="mini-label">Cantidad total</div>
                <div className="mini-value">{formatQty(calc.newQty)} nominales</div>
              </div>
              <div className="mini-card">
                <div className="mini-label">Capital invertido</div>
                <div className="mini-value">{formatMoney(calc.newInvested, priceCurrency)}</div>
              </div>
            </div>
            <div className="gp-card">
              <div className="gp-head">
                <span>
                  G/P al precio actual
                  {mode === 'existing' && asset ? ` (${formatMoney(asset.currentPrice, priceCurrency)})` : ''}
                </span>
              </div>
              <div className={'gp-value ' + (gp >= 0 ? 'positive' : 'negative')}>
                {(gp >= 0 ? '+' : '−') + formatMoney(Math.abs(gp), priceCurrency)}
                {calc.newInvested > 0
                  ? ` (${gp >= 0 ? '+' : '−'}${Math.abs(gpPct).toFixed(1).replace('.', ',')}%)`
                  : ''}
              </div>
            </div>
            {mode === 'existing' && asset && asset.history.length > 0 && (
              <div className="history-box">
                Historial de compras
                <br />
                <span className="history-lines">
                  {asset.history.map((h, i) => (
                    <span key={i}>
                      {h.date} · {formatQty(h.qty)} × {formatMoney(h.price, priceCurrency)}
                      {i < asset.history.length - 1 ? <br /> : null}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
