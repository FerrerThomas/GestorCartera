import { useEffect, useState } from 'react';
import AssetIcon from '../AssetIcon.jsx';
import Icon from './Icon.jsx';
import { formatPrice, nativeCurrency } from './AssetDetailSheet.jsx';
import { calcAveragePrice, formatMoney, formatQty, parseLocaleNumber, todayISODate } from '../../utils/finance.js';

const TITLES = { buy: 'Comprar', sell: 'Vender', deposit: 'Depositar', withdraw: 'Retirar' };
const CONFIRM = { buy: 'Confirmar compra', sell: 'Confirmar venta', deposit: 'Confirmar depósito', withdraw: 'Confirmar retiro' };
const toInput = (n) => (n ? String(Number(n.toFixed(6))).replace('.', ',') : '');

// Compra/venta de un activo que ya tenés, o depósito/retiro de una billetera.
export default function TradeSheet({ asset, account, mode, onClose, onSubmit }) {
  const cur = nativeCurrency(asset);
  const isFund = asset.kind === 'fund';
  const isCash = asset.category === 'Efectivo';
  const fixedPrice = isCash ? (asset.ticker === 'ARS' ? 1 : asset.currentPrice ?? 0) : null;

  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(toInput(asset.currentPrice ?? 0));
  const [tna, setTna] = useState(toInput(asset.tna ?? 0));
  const [date, setDate] = useState(todayISODate());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = parseLocaleNumber(qty);
  const p = fixedPrice ?? parseLocaleNumber(price);
  const have = isFund ? asset.value : asset.qty ?? 0;
  const selling = mode === 'sell' || mode === 'withdraw';
  const tooMuch = selling && q > have + 1e-9;
  const valid = q > 0 && (isFund || p > 0) && !tooMuch && !!date && date <= todayISODate();

  const submit = async (e) => {
    e?.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    let payload;
    if (mode === 'buy') payload = { type: 'existing', assetId: asset.id, qty: q, price: p, occurredOn: date };
    else if (mode === 'sell') payload = { type: 'sell', assetId: asset.id, qty: q, price: p, occurredOn: date };
    else if (mode === 'deposit')
      payload = { type: 'fund_topup', accountId: asset.accountId, amount: q, tna: parseLocaleNumber(tna), existingAssetId: asset.id, occurredOn: date };
    else payload = { type: 'fund_withdraw', accountId: asset.accountId, assetId: asset.id, amount: q, occurredOn: date };
    const ok = await onSubmit(payload);
    if (ok) onClose();
    else setBusy(false);
  };

  // Vista previa del resultado.
  const preview = [];
  if (isFund) {
    preview.push([mode === 'deposit' ? 'Saldo nuevo' : 'Saldo restante', formatMoney(have + (mode === 'deposit' ? q : -q), 'ARS')]);
  } else if (mode === 'buy') {
    const r = calcAveragePrice(asset.qty ?? 0, asset.avgPrice ?? 0, q, p);
    preview.push(['Total', formatMoney(q * p, cur)]);
    preview.push(['Vas a tener', formatQty(r.newQty)]);
    if (!isCash) preview.push(['Nuevo precio promedio', formatPrice(r.newAvgPrice, cur)]);
  } else {
    const result = q * (p - (asset.avgPrice ?? 0));
    preview.push(['Total', formatMoney(q * p, cur)]);
    preview.push(['Te quedan', formatQty(Math.max(0, have - q))]);
    if (!isCash)
      preview.push([
        'Resultado',
        <span key="r" style={{ color: result >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {(result >= 0 ? '+' : '−') + formatMoney(Math.abs(result), cur)}
        </span>,
      ]);
  }

  const qtyLabel = isFund ? 'Monto' : isCash ? `Monto (${asset.ticker})` : asset.category === 'CEDEAR' ? 'CEDEARs' : 'Cantidad';
  const title = isCash ? (mode === 'buy' ? 'Agregar' : 'Sacar') : TITLES[mode];

  return (
    <div className="sheet-overlay" onMouseDown={onClose} style={{ zIndex: 65 }}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="tr-title" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="sheet-head">
          <button type="button" className="icon-btn glass" aria-label="Cancelar" onClick={onClose}>
            <Icon name="close" size={18} stroke={2.6} />
          </button>
          <h1 id="tr-title" className="sheet-title">
            {title} {asset.ticker !== 'SALDO' ? asset.ticker : ''}
          </h1>
          <button type="submit" className="icon-btn glass tint" aria-label="Confirmar" disabled={!valid || busy} style={{ opacity: valid && !busy ? 1 : 0.45 }}>
            <Icon name="check" size={20} stroke={2.8} />
          </button>
        </header>

        <div className="sheet-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 20px 4px' }}>
            <AssetIcon asset={asset} accountName={account?.name} size={44} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{asset.name}</span>
              <span style={{ fontSize: 13, color: 'var(--label-2)' }} className="num">
                {isFund
                  ? `Saldo ${formatMoney(asset.value, 'ARS')} · TNA ${String(asset.tna ?? 0).replace('.', ',')}%`
                  : `Tenés ${formatQty(asset.qty ?? 0)} · cotiza ${formatPrice(asset.currentPrice ?? 0, cur)}`}
              </span>
            </div>
          </div>

          <ul className="form-list">
            <li>
              <label className="form-row">
                <span>{qtyLabel}</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={qty}
                  autoFocus
                  onChange={(e) => setQty(e.target.value)}
                  aria-invalid={tooMuch}
                  style={{ color: tooMuch ? 'var(--red)' : 'var(--label)', fontWeight: 600 }}
                />
                {selling && (
                  <button type="button" className="capsule-btn plain" style={{ minHeight: 30, padding: '0 10px', fontSize: 13 }} onClick={() => setQty(toInput(have))}>
                    Máx
                  </button>
                )}
              </label>
            </li>
            {!isFund && fixedPrice == null && (
              <li>
                <label className="form-row">
                  <span>{mode === 'buy' ? 'Precio de compra' : 'Precio de venta'}</span>
                  <input inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                </label>
              </li>
            )}
            {mode === 'deposit' && (
              <li>
                <label className="form-row">
                  <span>TNA %</span>
                  <input inputMode="decimal" value={tna} onChange={(e) => setTna(e.target.value)} />
                </label>
              </li>
            )}
            <li>
              <label className="form-row">
                <span>Fecha</span>
                <input type="date" value={date} max={todayISODate()} onChange={(e) => setDate(e.target.value)} />
              </label>
            </li>
          </ul>
          {!isFund && fixedPrice == null && (
            <p className="footnote" style={{ margin: '8px 24px 0' }}>
              Precio por unidad en {cur === 'USD' ? 'dólares' : 'pesos'}. Viene cargado con la cotización actual.
            </p>
          )}
          {tooMuch && (
            <div className="sheet-error" role="alert">
              No podés {mode === 'sell' ? 'vender' : 'retirar'} más de lo que tenés.
            </div>
          )}

          {q > 0 && !tooMuch && (
            <div className="preview-box" aria-live="polite">
              {preview.map(([k, v]) => (
                <div key={k}>
                  <span className="k">{k}</span>
                  <span className="v">{v}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ margin: '16px 16px 8px' }}>
            <button type="submit" className="glass tint capsule-btn" style={{ width: '100%', minHeight: 52, opacity: valid && !busy ? 1 : 0.45 }} disabled={!valid || busy}>
              {busy ? 'Guardando…' : isCash ? 'Confirmar' : CONFIRM[mode]}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
