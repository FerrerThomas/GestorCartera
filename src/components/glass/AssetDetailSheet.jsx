import { useEffect, useMemo, useState } from 'react';
import AssetIcon from '../AssetIcon.jsx';
import Icon from './Icon.jsx';
import { ActionSheet } from './ui.jsx';
import { calcAveragePrice, formatMoney, formatPct, formatQty } from '../../utils/finance.js';

// Moneda en la que cotiza el activo (CEDEARs/acciones en ARS; cripto y skins en USD).
export function nativeCurrency(asset) {
  return asset.currency === 'USD' ? 'USD' : 'ARS';
}

// Precio con decimales cuando hace falta (cripto en USD, CEDEARs baratos).
export function formatPrice(value, currency) {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 0 : abs >= 1 ? 2 : 6;
  const n = Number(value).toLocaleString('es-AR', { maximumFractionDigits: digits });
  return (currency === 'USD' ? 'US$' : '$') + n;
}

// Recorre el historial en orden y calcula PPC vigente en cada operación,
// el resultado realizado de cada venta y el rendimiento actual de cada compra.
export function analyzeHistory(asset) {
  let qty = 0;
  let avg = 0;
  let realized = 0;
  let bought = 0;
  const ops = [];
  for (const h of asset.history) {
    if (h.qty > 0) {
      const r = calcAveragePrice(qty, avg, h.qty, h.price);
      bought += h.qty * h.price;
      ops.push({ ...h, kind: 'buy' });
      qty = r.newQty;
      avg = r.newAvgPrice;
    } else {
      const q = -h.qty;
      const result = q * (h.price - avg);
      realized += result;
      ops.push({ ...h, kind: 'sell', result, avgAt: avg });
      qty = Math.max(0, qty - q);
    }
  }
  return { ops: ops.reverse(), realized, bought };
}

function Stat({ label, value, tone }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

const signed = (v, cur) => (v >= 0 ? '+' : '−') + formatMoney(Math.abs(v), cur);
const tone = (v) => (Math.abs(v) < 0.005 ? undefined : v > 0 ? 'var(--green)' : 'var(--red)');

export default function AssetDetailSheet({ asset, account, usdArs, onClose, onTrade, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cur = nativeCurrency(asset);
  const isFund = asset.kind === 'fund';
  const isCash = asset.category === 'Efectivo';
  const { ops, realized } = useMemo(() => analyzeHistory(asset), [asset]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !confirmDelete && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmDelete]);

  const price = asset.currentPrice ?? 0;
  const value = isFund ? asset.value : (asset.qty ?? 0) * price;
  const invested = isFund ? asset.value - (asset.gainAbs ?? 0) : (asset.qty ?? 0) * (asset.avgPrice ?? 0);
  const gain = value - invested;
  const pct = invested ? (gain / invested) * 100 : 0;
  // Equivalente en la otra moneda, como referencia.
  const valueArs = cur === 'USD' ? value * usdArs : value;
  const other = cur === 'USD' ? formatMoney(valueArs, 'ARS') : formatMoney(valueArs / usdArs, 'USD');
  const qtyLabel = isCash && asset.ticker === 'USD' ? 'Dólares' : asset.category === 'CEDEAR' ? 'CEDEARs' : 'Cantidad';

  return (
    <>
    <div className="sheet-overlay" onMouseDown={onClose}>
      <div className="sheet tall" role="dialog" aria-modal="true" aria-labelledby="ad-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="sheet-head">
          <button type="button" className="icon-btn glass" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={18} stroke={2.6} />
          </button>
          <h1 id="ad-title" className="sheet-title">
            {isFund ? account?.name ?? 'Billetera' : asset.ticker}
          </h1>
          <button type="button" className="icon-btn glass" aria-label={`Eliminar ${asset.ticker}`} onClick={() => setConfirmDelete(true)} style={{ color: 'var(--red)' }}>
            <Icon name="trash" size={19} />
          </button>
        </header>

        <div className="sheet-body">
          <section className="asset-hero" aria-label="Valor actual">
            <AssetIcon asset={asset} accountName={account?.name} size={64} />
            <span style={{ fontSize: 15, color: 'var(--label-2)' }}>
              {isFund
                ? ['Billetera', account?.name, asset.yieldSource?.fund?.replace(/ - Clase .*/, '')].filter(Boolean).join(' · ')
                : [asset.name !== asset.ticker ? asset.name : null, asset.category, account?.name].filter(Boolean).join(' · ')}
            </span>
            <span className="asset-hero-value">{formatMoney(value, cur)}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: tone(gain) }} className="num">
              {signed(gain, cur)}
              {!isFund && invested > 0 && ` (${formatPct(pct)})`}
              <span style={{ color: 'var(--label-2)', fontWeight: 400 }}> {isFund ? 'de interés' : 'de ganancia'}</span>
            </span>
            <span style={{ fontSize: 13, color: 'var(--label-3)' }} className="num">
              ≈ {other}
            </span>
          </section>

          <div className="stat-grid">
            {isFund && asset.units != null ? (
              <>
                <Stat label="Saldo" value={formatMoney(asset.value, 'ARS')} />
                <Stat label="TNA del fondo" value={`${(asset.tna ?? 0).toFixed(2).replace('.', ',')}%`} />
                <Stat label="Cuotapartes" value={formatQty(asset.units)} />
                <Stat label="Valor cuotaparte" value={'$' + Number(asset.vcp ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 3 })} />
                <Stat label="Depositado neto" value={formatMoney(invested, 'ARS')} />
                <Stat label="Interés ganado" value={signed(gain, 'ARS')} tone={tone(gain)} />
              </>
            ) : isFund ? (
              <>
                <Stat label="Saldo" value={formatMoney(asset.value, 'ARS')} />
                <Stat label="TNA" value={`${String(asset.tna ?? 0).replace('.', ',')}%`} />
                <Stat label="Depositado" value={formatMoney(invested, 'ARS')} />
                <Stat label="Interés por día" value={`~${formatMoney((asset.value * (asset.tna ?? 0)) / 100 / 365, 'ARS')}`} />
              </>
            ) : (
              <>
                <Stat label={qtyLabel} value={formatQty(asset.qty ?? 0)} />
                <Stat label="Precio actual" value={formatPrice(price, cur)} />
                <Stat label="Precio promedio" value={formatPrice(asset.avgPrice ?? 0, cur)} />
                <Stat label="Invertido" value={formatMoney(invested, cur)} />
                <Stat label="Ganancia sin realizar" value={signed(gain, cur)} tone={tone(gain)} />
                <Stat label="Resultado de ventas" value={ops.some((o) => o.kind === 'sell') ? signed(realized, cur) : '—'} tone={tone(realized)} />
              </>
            )}
          </div>

          {isFund && asset.units != null && (
            <p className="footnote" style={{ margin: '10px 24px 0', textAlign: 'center' }}>
              Rinde como <strong>{asset.yieldSource?.fund ?? 'el fondo'}</strong>. Valor de cuotaparte al{' '}
              {String(asset.vcpDate ?? '').split('-').reverse().join('/')} (los fondos publican con unos días de atraso).
            </p>
          )}
          {isFund && asset.units == null && asset.yieldSource?.mode === 'api' && (
            <p className="footnote" style={{ margin: '10px 24px 0', textAlign: 'center' }}>
              TNA automática con la tasa que publica {asset.yieldSource.entity}.
            </p>
          )}

          <div className="sheet-actions">
            <button type="button" className="glass tint" onClick={() => onTrade(isFund ? 'deposit' : 'buy')}>
              <Icon name="plus" size={18} stroke={2.6} /> {isFund ? 'Depositar' : isCash ? 'Agregar' : 'Comprar'}
            </button>
            <button
              type="button"
              className="glass"
              onClick={() => onTrade(isFund ? 'withdraw' : 'sell')}
              disabled={isFund ? asset.value <= 0.01 : (asset.qty ?? 0) <= 0}
            >
              <Icon name="minus" size={18} stroke={2.6} /> {isFund ? 'Retirar' : isCash ? 'Sacar' : 'Vender'}
            </button>
          </div>

          <h2 className="sheet-section-title">Operaciones</h2>
          {ops.length === 0 ? (
            <p className="footnote" style={{ margin: '0 24px' }}>
              Sin operaciones registradas.
            </p>
          ) : (
            <ul className="list">
              {ops.map((o, i) => {
                const isBuy = o.kind === 'buy';
                const total = Math.abs(o.qty) * o.price;
                let title;
                let detail;
                let extra = null;
                if (isFund) {
                  title = isBuy ? 'Depósito' : 'Retiro';
                  detail = o.date;
                } else {
                  title = `${isBuy ? 'Compra' : 'Venta'} · ${formatQty(Math.abs(o.qty))}`;
                  detail = `${o.date} · a ${formatPrice(o.price, cur)}`;
                  if (isBuy && !isCash && price > 0) {
                    const lot = o.qty * (price - o.price);
                    extra = (
                      <span className="op-sub2" style={{ color: tone(lot) }}>
                        Hoy {signed(lot, cur)} ({formatPct(((price - o.price) / o.price) * 100)})
                      </span>
                    );
                  } else if (!isBuy && !isCash) {
                    extra = (
                      <span className="op-sub2" style={{ color: tone(o.result) }}>
                        Resultado {signed(o.result, cur)}
                      </span>
                    );
                  }
                }
                return (
                  <li key={`${o.dateRaw}-${i}`}>
                    <div className="row" style={{ minHeight: 62 }}>
                      <span className="dot-icon sm" aria-hidden="true" style={{ background: isBuy ? '#34C759' : '#FF9500' }}>
                        <Icon name={isBuy ? 'plus' : 'minus'} size={16} stroke={2.8} />
                      </span>
                      <span className="row-body">
                        <span className="row-main">
                          <span className="row-title">{title}</span>
                          <span className="row-sub">{detail}</span>
                          {extra}
                        </span>
                        <span className="row-value" style={{ alignSelf: 'flex-start', paddingTop: 2 }}>
                          {formatMoney(total, cur)}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div style={{ height: 24 }} />
        </div>
      </div>
    </div>

    {confirmDelete && (
      <ActionSheet
        message={`Se elimina ${asset.ticker} con todas sus operaciones. No se puede deshacer.`}
        actions={[{ label: `Eliminar ${asset.ticker}`, danger: true, onSelect: () => onDelete(asset.id) }]}
        onClose={() => setConfirmDelete(false)}
      />
    )}
    </>
  );
}
