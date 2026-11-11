import { useEffect, useMemo, useRef, useState } from 'react';
import Icon, { accountColor } from './Icon.jsx';
import { Segmented } from './ui.jsx';
import { formatPrice } from './AssetDetailSheet.jsx';
import { CRYPTO_CATALOG } from '../../data/cryptoCatalog.js';
import { findSkinImage } from '../../data/cs2images.js';
import {
  fetchArgCedearsCatalog,
  fetchArgStocksCatalog,
  fetchCryptoPrices,
  fetchCs2Catalog,
} from '../../services/marketData.js';
import { calcAveragePrice, formatMoney, formatQty, parseLocaleNumber, todayISODate } from '../../utils/finance.js';

// Catálogos cacheados por sesión (son listas grandes).
const cache = {};
function loadCatalog(key) {
  if (!cache[key]) {
    cache[key] =
      key === 'Acción'
        ? fetchArgStocksCatalog()
        : key === 'CEDEAR'
          ? fetchArgCedearsCatalog()
          : key === 'Skin CS2'
            ? fetchCs2Catalog()
            : fetchCryptoPrices(CRYPTO_CATALOG.map((c) => c.ticker)).then((prices) =>
                CRYPTO_CATALOG.map((c) => ({ ...c, price: prices[c.ticker] ?? null }))
              );
  }
  return cache[key];
}

const toInput = (n) => (n ? String(Number(Number(n).toFixed(6))).replace('.', ',') : '');

export default function AddAssetSheet({ accounts, assets, initialAccountId, usdArs, onClose, onSubmit }) {
  const usable = accounts;
  const [accountId, setAccountId] = useState(initialAccountId ?? usable.find((a) => a.type === 'broker')?.id ?? usable[0]?.id ?? '');
  const account = accounts.find((a) => a.id === accountId);
  const type = account?.type;
  const [brokerCat, setBrokerCat] = useState('CEDEAR');
  const [cashCur, setCashCur] = useState('ARS');
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [tna, setTna] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [busy, setBusy] = useState(false);
  const qtyRef = useRef(null);

  const category =
    type === 'broker' ? brokerCat : type === 'exchange' ? 'Cripto' : type === 'steam' ? 'Skin CS2' : type === 'efectivo' ? 'Efectivo' : 'Fondo money market';
  const needsCatalog = type === 'broker' || type === 'exchange' || type === 'steam';
  const assetCurrency = type === 'exchange' || type === 'steam' ? 'USD' : 'ARS';
  const existingFund = assets.find((a) => a.accountId === accountId && a.kind === 'fund');

  useEffect(() => {
    setPicked(null);
    setQuery('');
    setQty('');
    setPrice('');
    setImageUrl(null);
    setTna(existingFund ? toInput(existingFund.tna) : '');
    setCashCur(account?.currency ?? 'ARS');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, brokerCat]);

  useEffect(() => {
    if (!needsCatalog) return;
    let cancelled = false;
    setCatalogLoading(true);
    loadCatalog(category).then((list) => {
      if (cancelled) return;
      setCatalog(list ?? []);
      setCatalogLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [needsCatalog, category]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const owned = (ticker) => assets.find((a) => a.accountId === accountId && a.kind !== 'fund' && a.ticker === ticker);

  const results = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (type === 'steam' && q.length < 2) return [];
    const list = q ? catalog.filter((o) => o.ticker.toUpperCase().includes(q) || o.name?.toUpperCase().includes(q)) : catalog;
    // Primero lo que ya tenés, después coincidencia exacta.
    return list
      .slice()
      .sort((a, b) => (owned(b.ticker) ? 1 : 0) - (owned(a.ticker) ? 1 : 0) || (b.ticker.toUpperCase() === q) - (a.ticker.toUpperCase() === q))
      .slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, query, type, accountId, assets]);

  const pick = (o) => {
    setPicked(o);
    setPrice(toInput(o.price));
    setTimeout(() => qtyRef.current?.focus(), 50);
    if (type === 'steam') findSkinImage(o.ticker).then(setImageUrl);
  };

  // Efectivo: la "posición" es la moneda.
  const cashTicker = cashCur;
  const cashPrice = cashCur === 'ARS' ? 1 : owned('USD')?.currentPrice ?? usdArs;

  const ticker = type === 'efectivo' ? cashTicker : picked?.ticker;
  const existing = ticker ? owned(ticker) : null;
  const q = parseLocaleNumber(qty);
  const p = type === 'efectivo' ? cashPrice : parseLocaleNumber(price);
  const isFund = type === 'billetera';
  const valid = isFund ? q > 0 && !!date : !!ticker && q > 0 && p > 0 && !!date && date <= todayISODate();

  const submit = async (e) => {
    e?.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    let payload;
    if (isFund) {
      payload = { type: 'fund_topup', accountId, amount: q, tna: parseLocaleNumber(tna), existingAssetId: existingFund?.id ?? null, occurredOn: date };
    } else if (existing) {
      payload = { type: 'existing', assetId: existing.id, qty: q, price: p, occurredOn: date };
    } else {
      const name =
        type === 'efectivo' ? (cashCur === 'ARS' ? 'Pesos' : 'Dólar billete') : picked?.name || ticker;
      payload = {
        type: 'new',
        qty: q,
        price: p,
        occurredOn: date,
        asset: { ticker, name, category, accountId, currency: assetCurrency, imageUrl: imageUrl || null },
      };
    }
    const ok = await onSubmit(payload);
    if (ok) onClose();
    else setBusy(false);
  };

  const preview = [];
  if (!isFund && q > 0 && p > 0) {
    preview.push(['Total', formatMoney(q * p, assetCurrency)]);
    if (existing) {
      const r = calcAveragePrice(existing.qty ?? 0, existing.avgPrice ?? 0, q, p);
      preview.push(['Vas a tener', formatQty(r.newQty)]);
      if (type !== 'efectivo') preview.push(['Nuevo precio promedio', formatPrice(r.newAvgPrice, assetCurrency)]);
    }
  } else if (isFund && q > 0) {
    preview.push(['Saldo nuevo', formatMoney((existingFund?.value ?? 0) + q, 'ARS')]);
  }

  return (
    <div className="sheet-overlay" onMouseDown={onClose}>
      <form className="sheet tall" role="dialog" aria-modal="true" aria-labelledby="aa-title" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="sheet-head">
          <button type="button" className="icon-btn glass" aria-label="Cancelar" onClick={onClose}>
            <Icon name="close" size={18} stroke={2.6} />
          </button>
          <h1 id="aa-title" className="sheet-title">
            {isFund ? 'Depositar' : existing ? `Comprar más ${existing.ticker}` : 'Agregar activo'}
          </h1>
          <button type="submit" className="icon-btn glass tint" aria-label="Guardar" disabled={!valid || busy} style={{ opacity: valid && !busy ? 1 : 0.45 }}>
            <Icon name="check" size={20} stroke={2.8} />
          </button>
        </header>

        <div className="sheet-body">
          <h2 className="sheet-section-title" style={{ marginTop: 12 }}>
            Cuenta
          </h2>
          <div className="chips in-sheet" role="radiogroup" aria-label="Cuenta" style={{ marginTop: 0 }}>
            {usable.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === accountId}
                className={`chip-glass glass${a.id === accountId ? ' tint' : ''}`}
                onClick={() => setAccountId(a.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 5, background: a.id === accountId ? '#fff' : accountColor(a) }} />
                {a.name}
              </button>
            ))}
          </div>

          {type === 'broker' && (
            <Segmented
              label="Tipo"
              value={brokerCat}
              onChange={setBrokerCat}
              options={[
                { value: 'CEDEAR', label: 'CEDEARs' },
                { value: 'Acción', label: 'Acciones' },
              ]}
            />
          )}
          {type === 'efectivo' && (
            <Segmented
              label="Moneda"
              value={cashCur}
              onChange={setCashCur}
              options={[
                { value: 'ARS', label: 'Pesos' },
                { value: 'USD', label: 'Dólares' },
              ]}
            />
          )}

          {needsCatalog && !picked && (
            <>
              <div style={{ margin: '12px 16px 8px', position: 'relative' }}>
                <Icon name="search" size={17} stroke={2.2} color="var(--label-2)" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  className="text-input"
                  type="search"
                  style={{ paddingLeft: 36 }}
                  placeholder={type === 'steam' ? 'Buscá la skin (ej: AK-47 | Redline)' : type === 'exchange' ? 'Buscá la cripto (ej: BTC)' : 'Buscá el ticker (ej: MELI)'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar activo"
                  autoFocus
                />
              </div>
              <ul className="list search-results" aria-label="Resultados">
                {catalogLoading && <li className="empty">Cargando cotizaciones…</li>}
                {!catalogLoading && results.length === 0 && (
                  <li className="empty">{type === 'steam' && query.trim().length < 2 ? 'Escribí al menos 2 letras' : 'Sin resultados'}</li>
                )}
                {results.map((o) => {
                  const own = owned(o.ticker);
                  return (
                    <li key={o.ticker}>
                      <button type="button" className="row" onClick={() => pick(o)} style={{ minHeight: 52 }}>
                        <span className="row-body">
                          <span className="row-main">
                            <span className="row-title strong">{o.ticker}</span>
                            {o.name && o.name !== o.ticker && <span className="row-sub">{o.name}</span>}
                          </span>
                          {own && (own.qty ?? 0) > 0 && <span className="owned-badge">Tenés {formatQty(own.qty ?? 0)}</span>}
                          {o.price != null && <span className="row-value" style={{ fontSize: 15 }}>{formatPrice(o.price, assetCurrency)}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {needsCatalog && picked && (
            <ul className="list" style={{ marginTop: 12 }}>
              <li>
                <div className="row" style={{ minHeight: 60 }}>
                  {imageUrl && <img src={imageUrl} alt="" width={44} height={44} style={{ objectFit: 'contain', flex: 'none' }} />}
                  <span className="row-body">
                    <span className="row-main">
                      <span className="row-title strong">{picked.ticker}</span>
                      <span className="row-sub">
                        {existing ? `Ya tenés ${formatQty(existing.qty ?? 0)} · se suma a tu posición` : 'Activo nuevo en esta cuenta'}
                      </span>
                    </span>
                    <button type="button" className="capsule-btn plain" style={{ minHeight: 32, padding: '0 12px', fontSize: 14 }} onClick={() => setPicked(null)}>
                      Cambiar
                    </button>
                  </span>
                </div>
              </li>
            </ul>
          )}

          {(isFund || type === 'efectivo' || picked) && (
            <>
              <ul className="form-list" style={{ marginTop: 12 }}>
                <li>
                  <label className="form-row">
                    <span>{isFund ? 'Monto (ARS)' : type === 'efectivo' ? `Monto (${cashCur})` : type === 'broker' && brokerCat === 'CEDEAR' ? 'CEDEARs' : 'Cantidad'}</span>
                    <input ref={qtyRef} inputMode="decimal" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} style={{ color: 'var(--label)', fontWeight: 600 }} autoFocus={!needsCatalog} />
                  </label>
                </li>
                {needsCatalog && (
                  <li>
                    <label className="form-row">
                      <span>Precio de compra</span>
                      <input inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                    </label>
                  </li>
                )}
                {isFund && (
                  <li>
                    <label className="form-row">
                      <span>TNA %</span>
                      <input inputMode="decimal" placeholder="0" value={tna} onChange={(e) => setTna(e.target.value)} />
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
              {needsCatalog && (
                <p className="footnote" style={{ margin: '8px 24px 0' }}>
                  Precio por unidad en {assetCurrency === 'USD' ? 'dólares' : 'pesos'}, cargado con la cotización actual.
                </p>
              )}
              {type === 'efectivo' && cashCur === 'USD' && (
                <p className="footnote" style={{ margin: '8px 24px 0' }}>
                  Se registra al dólar blue de hoy ({formatMoney(cashPrice, 'ARS')}).
                </p>
              )}
              {preview.length > 0 && (
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
                  {busy ? 'Guardando…' : isFund ? 'Depositar' : existing ? 'Sumar a mi posición' : 'Agregar activo'}
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
