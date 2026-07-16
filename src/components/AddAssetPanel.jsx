import { useEffect, useMemo, useState } from 'react';
import {
  calcAveragePrice,
  formatMoney,
  formatQty,
  parseLocaleNumber,
  todayISODate,
} from '../utils/finance.js';
import {
  fetchArgCedearsCatalog,
  fetchArgStocksCatalog,
  fetchCs2Catalog,
  fetchDolarBlue,
} from '../services/marketData.js';
import { CRYPTO_CATALOG } from '../data/cryptoCatalog.js';
import { findSkinImage } from '../data/cs2images.js';
import TickerPicker from './TickerPicker.jsx';

const EFECTIVO_OPTIONS = [
  { ticker: 'ARS', name: 'Pesos' },
  { ticker: 'USD', name: 'Dólar billete' },
];

export default function AddAssetPanel({ assets, accounts, initialAccountId, onClose, onSubmit }) {
  const [accountId, setAccountId] = useState(initialAccountId ?? accounts[0]?.id ?? '');
  const account = accounts.find((a) => a.id === accountId);
  const accountType = account?.type;
  const isBilletera = accountType === 'billetera';

  const purchasableAll = assets.filter((a) => a.kind !== 'fund');
  const purchasable = useMemo(
    () => purchasableAll.filter((a) => a.accountId === accountId),
    [purchasableAll, accountId]
  );
  const existingFund = assets.find((a) => a.accountId === accountId && a.kind === 'fund');

  const [tab, setTab] = useState('compra');
  const [brokerCategory, setBrokerCategory] = useState('Acción');
  const [ticker, setTicker] = useState('');
  const [efectivoCurrency, setEfectivoCurrency] = useState('ARS');
  const [addQty, setAddQty] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositTna, setDepositTna] = useState('17,5');
  const [depositMode, setDepositMode] = useState('deposito');
  const [opDate, setOpDate] = useState(todayISODate());
  const [sellAssetId, setSellAssetId] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [sellPrice, setSellPrice] = useState('');

  const [stocksCatalog, setStocksCatalog] = useState([]);
  const [cedearsCatalog, setCedearsCatalog] = useState([]);
  const [cs2Catalog, setCs2Catalog] = useState([]);
  const [dolarBlueLive, setDolarBlueLive] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imgBroken, setImgBroken] = useState(false);

  // Reset selections whenever the account (and therefore its type) changes.
  useEffect(() => {
    setTab('compra');
    setBrokerCategory('Acción');
    setTicker('');
    setEfectivoCurrency(account?.currency ?? 'ARS');
    setAddQty('');
    setAddPrice('');
    setDepositAmount('');
    setDepositTna(existingFund ? String(existingFund.tna).replace('.', ',') : '17,5');
    setOpDate(todayISODate());
    setImageUrl('');
    setDepositMode('deposito');
    setSellAssetId('');
    setSellQty('');
    setSellPrice('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    if (accountType === 'broker' && brokerCategory === 'Acción' && stocksCatalog.length === 0) {
      fetchArgStocksCatalog().then(setStocksCatalog);
    }
    if (accountType === 'broker' && brokerCategory === 'CEDEAR' && cedearsCatalog.length === 0) {
      fetchArgCedearsCatalog().then(setCedearsCatalog);
    }
    if (accountType === 'steam' && cs2Catalog.length === 0) {
      fetchCs2Catalog().then(setCs2Catalog);
    }
  }, [accountType, brokerCategory, stocksCatalog.length, cedearsCatalog.length, cs2Catalog.length]);

  const category =
    accountType === 'exchange'
      ? 'Cripto'
      : accountType === 'broker'
        ? brokerCategory
        : accountType === 'steam'
          ? 'Skin CS2'
          : 'Efectivo';
  const selectedTicker = accountType === 'efectivo' ? efectivoCurrency : ticker;
  const existingAsset = purchasable.find((a) => a.ticker === selectedTicker);

  useEffect(() => {
    if (
      accountType === 'efectivo' &&
      efectivoCurrency === 'USD' &&
      !existingAsset &&
      dolarBlueLive == null
    ) {
      fetchDolarBlue().then(setDolarBlueLive);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountType, efectivoCurrency, existingAsset]);

  const q = parseLocaleNumber(addQty);
  const isEfectivo = accountType === 'efectivo';
  const efectivoPrice =
    efectivoCurrency === 'ARS' ? 1 : existingAsset?.currentPrice ?? dolarBlueLive ?? 0;
  const p = isEfectivo ? efectivoPrice : parseLocaleNumber(addPrice);
  const assetCurrency = accountType === 'exchange' || accountType === 'steam' ? 'USD' : 'ARS';
  const priceCurrency = existingAsset ? (existingAsset.currency === 'USD' ? 'USD' : 'ARS') : assetCurrency;

  const calc = useMemo(() => {
    if (!existingAsset) return calcAveragePrice(0, 0, q, p);
    return calcAveragePrice(existingAsset.qty, existingAsset.avgPrice, q, p);
  }, [existingAsset, q, p]);

  const currentPrice = existingAsset ? existingAsset.currentPrice ?? 0 : p;
  const gp = calc.newQty * currentPrice - calc.newInvested;
  const gpPct = calc.newInvested > 0 ? (gp / calc.newInvested) * 100 : 0;
  const opTotal = q * p;

  const nameFor = (t) => {
    if (accountType === 'exchange') return CRYPTO_CATALOG.find((c) => c.ticker === t)?.name ?? t;
    if (accountType === 'efectivo') return EFECTIVO_OPTIONS.find((c) => c.ticker === t)?.name ?? t;
    return t;
  };

  // Al elegir una skin, buscar su imagen en el dataset (editable después a mano).
  useEffect(() => {
    if (accountType !== 'steam' || !ticker) {
      setImageUrl('');
      return;
    }
    let cancelled = false;
    findSkinImage(ticker).then((url) => {
      if (!cancelled) {
        setImageUrl(url ?? '');
        setImgBroken(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountType, ticker]);

  const dateValid = !!opDate && opDate <= todayISODate();
  const canSubmit = tab === 'compra' && !!selectedTicker && q > 0 && p > 0 && dateValid;

  // ----- Venta -----
  const sellable = purchasable.filter((a) => (a.qty ?? 0) > 0);
  const sellAsset = sellable.find((a) => a.id === sellAssetId);
  const sellCurrency = sellAsset?.currency === 'USD' ? 'USD' : 'ARS';

  // Preseleccionar el primer activo vendible y prellenar el precio actual.
  useEffect(() => {
    if (tab !== 'venta') return;
    if (!sellAsset && sellable.length > 0) {
      setSellAssetId(sellable[0].id);
      return;
    }
    if (sellAsset) {
      const isCash = sellAsset.category === 'Efectivo';
      setSellPrice(
        isCash ? '' : String(sellAsset.currentPrice ?? '').replace('.', ',')
      );
      setSellQty('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sellAssetId, sellable.length]);

  const sellIsCash = sellAsset?.category === 'Efectivo';
  const sellQtyNum = parseLocaleNumber(sellQty);
  const sellPriceNum = sellIsCash
    ? sellAsset?.ticker === 'ARS'
      ? 1
      : sellAsset?.currentPrice ?? 0
    : parseLocaleNumber(sellPrice);
  const sellRealized = sellAsset ? sellQtyNum * (sellPriceNum - (sellAsset.avgPrice ?? 0)) : 0;
  const canSubmitSell =
    tab === 'venta' &&
    !!sellAsset &&
    sellQtyNum > 0 &&
    sellQtyNum <= (sellAsset?.qty ?? 0) &&
    sellPriceNum > 0 &&
    dateValid;

  const submitSell = () => {
    if (!canSubmitSell) return;
    onSubmit({
      type: 'sell',
      assetId: sellAsset.id,
      qty: sellQtyNum,
      price: sellPriceNum,
      occurredOn: opDate,
    });
  };

  const submit = () => {
    if (!canSubmit) return;
    if (existingAsset) {
      onSubmit({ type: 'existing', assetId: existingAsset.id, qty: q, price: p, occurredOn: opDate });
    } else {
      onSubmit({
        type: 'new',
        qty: q,
        price: p,
        occurredOn: opDate,
        asset: {
          ticker: selectedTicker,
          name: nameFor(selectedTicker),
          category,
          accountId,
          currency: assetCurrency,
          imageUrl: imageUrl.trim() || null,
        },
      });
    }
  };

  const depositAmountNum = parseLocaleNumber(depositAmount);
  const depositTnaNum = parseLocaleNumber(depositTna);
  const isWithdraw = depositMode === 'retiro';
  const fundBalance = existingFund?.value ?? 0;
  const canSubmitDeposit = isWithdraw
    ? !!existingFund && depositAmountNum > 0 && depositAmountNum <= fundBalance && dateValid
    : depositAmountNum > 0 && depositTnaNum >= 0 && dateValid;

  const submitDeposit = () => {
    if (!canSubmitDeposit) return;
    if (isWithdraw) {
      onSubmit({
        type: 'fund_withdraw',
        accountId,
        assetId: existingFund.id,
        amount: depositAmountNum,
        occurredOn: opDate,
      });
    } else {
      onSubmit({
        type: 'fund_topup',
        accountId,
        amount: depositAmountNum,
        tna: depositTnaNum,
        existingAssetId: existingFund?.id ?? null,
        occurredOn: opDate,
      });
    }
  };

  const stockOptions = brokerCategory === 'Acción' ? stocksCatalog : cedearsCatalog;

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
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Cuentas /{' '}
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{account?.name ?? '—'}</span>{' '}
            / Agregar operación
          </span>
        </div>

        <div className="asset-panel-body">
          {/* form */}
          <div className="asset-panel-form">
            <label className="field">
              <span className="field-label">Cuenta</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            {isBilletera ? (
              <>
                <div className="type-toggle-row">
                  <button
                    type="button"
                    className={'type-toggle-btn' + (!isWithdraw ? ' active' : '')}
                    onClick={() => setDepositMode('deposito')}
                  >
                    Depósito
                  </button>
                  <button
                    type="button"
                    className={'type-toggle-btn' + (isWithdraw ? ' active' : '')}
                    onClick={() => setDepositMode('retiro')}
                    disabled={!existingFund}
                    title={!existingFund ? 'Todavía no hay saldo en esta billetera' : undefined}
                  >
                    Retiro
                  </button>
                </div>
                <div className={isWithdraw ? '' : 'field-grid'}>
                  <label className="field">
                    <span className="field-label">Monto (ARS)</span>
                    <input
                      className="mono"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0"
                    />
                    {isWithdraw && (
                      <span className="have-qty" style={{ marginLeft: 0 }}>
                        disponible: {formatMoney(fundBalance, 'ARS')}
                      </span>
                    )}
                  </label>
                  {!isWithdraw && (
                    <label className="field">
                      <span className="field-label">TNA (%)</span>
                      <input
                        className="mono"
                        value={depositTna}
                        onChange={(e) => setDepositTna(e.target.value)}
                        placeholder="17,5"
                      />
                    </label>
                  )}
                </div>
                <label className="field">
                  <span className="field-label">Fecha del depósito</span>
                  <input
                    type="date"
                    className="mono"
                    value={opDate}
                    max={todayISODate()}
                    onChange={(e) => setOpDate(e.target.value)}
                  />
                </label>
                <div className="op-total">
                  Saldo actual: <span>{formatMoney(fundBalance, 'ARS')}</span>
                </div>
                <button className="btn-submit" disabled={!canSubmitDeposit} onClick={submitDeposit}>
                  {isWithdraw ? 'Retirar' : 'Depositar'}
                </button>
              </>
            ) : (
              <>
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
                </div>

                {tab === 'venta' &&
                  (sellable.length === 0 ? (
                    <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '8px 0' }}>
                      No hay activos para vender en esta cuenta.
                    </div>
                  ) : (
                    <>
                      <label className="field">
                        <span className="field-label">Activo</span>
                        <select value={sellAssetId} onChange={(e) => setSellAssetId(e.target.value)}>
                          {sellable.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.ticker} — tenés {formatQty(a.qty)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className={sellIsCash ? '' : 'field-grid'}>
                        <label className="field">
                          <span className="field-label">
                            {sellIsCash ? `Monto (${sellAsset?.ticker})` : 'Cantidad'}
                          </span>
                          <input
                            className="mono"
                            value={sellQty}
                            onChange={(e) => setSellQty(e.target.value)}
                            placeholder="0"
                          />
                          {sellAsset && (
                            <button
                              type="button"
                              className="have-qty"
                              style={{
                                marginLeft: 0,
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                              onClick={() =>
                                setSellQty(String(sellAsset.qty).replace('.', ','))
                              }
                            >
                              máx: {formatQty(sellAsset.qty)}
                            </button>
                          )}
                        </label>
                        {!sellIsCash && (
                          <label className="field">
                            <span className="field-label">Precio de venta ({sellCurrency})</span>
                            <input
                              className="mono"
                              value={sellPrice}
                              onChange={(e) => setSellPrice(e.target.value)}
                              placeholder="0"
                            />
                          </label>
                        )}
                      </div>

                      <label className="field" style={{ maxWidth: 220 }}>
                        <span className="field-label">Fecha</span>
                        <input
                          type="date"
                          className="mono"
                          value={opDate}
                          max={todayISODate()}
                          onChange={(e) => setOpDate(e.target.value)}
                        />
                      </label>

                      <div className="op-total">
                        Total venta: <span>{formatMoney(sellQtyNum * sellPriceNum, sellCurrency)}</span>
                      </div>

                      <button className="btn-submit" disabled={!canSubmitSell} onClick={submitSell}>
                        Registrar venta
                      </button>
                    </>
                  ))}

                {tab === 'compra' && (
                  <>
                    {accountType === 'broker' && (
                      <label className="field">
                        <span className="field-label">Categoría</span>
                        <div className="type-toggle-row">
                          <button
                            type="button"
                            className={'type-toggle-btn' + (brokerCategory === 'Acción' ? ' active' : '')}
                            onClick={() => {
                              setBrokerCategory('Acción');
                              setTicker('');
                            }}
                          >
                            Acción
                          </button>
                          <button
                            type="button"
                            className={'type-toggle-btn' + (brokerCategory === 'CEDEAR' ? ' active' : '')}
                            onClick={() => {
                              setBrokerCategory('CEDEAR');
                              setTicker('');
                            }}
                          >
                            CEDEAR
                          </button>
                        </div>
                      </label>
                    )}

                    {(accountType === 'broker' || accountType === 'exchange' || accountType === 'steam') && (
                      <label className="field">
                        <span className="field-label">{accountType === 'steam' ? 'Skin' : 'Activo'}</span>
                        <TickerPicker
                          options={
                            accountType === 'exchange'
                              ? CRYPTO_CATALOG
                              : accountType === 'steam'
                                ? cs2Catalog
                                : stockOptions
                          }
                          value={ticker}
                          onChange={setTicker}
                          priceCurrency={accountType === 'steam' ? 'USD' : 'ARS'}
                          placeholder={
                            accountType === 'exchange'
                              ? 'Buscar cripto (BTC, ETH...)'
                              : accountType === 'steam'
                                ? cs2Catalog.length === 0
                                  ? 'Cargando catálogo…'
                                  : 'Buscar skin (AK-47 Redline, AWP...)'
                                : 'Buscar ticker'
                          }
                        />
                        {existingAsset && (
                          <span className="have-qty" style={{ marginLeft: 0 }}>
                            ya tenés {formatQty(existingAsset.qty)}
                          </span>
                        )}
                      </label>
                    )}

                    {accountType === 'steam' && ticker && (
                      <label className="field">
                        <span className="field-label">URL de imagen (opcional)</span>
                        <div className="skin-image-row">
                          {imageUrl && !imgBroken && (
                            <img
                              className="skin-image-preview"
                              src={imageUrl}
                              alt={ticker}
                              onError={() => setImgBroken(true)}
                            />
                          )}
                          <input
                            value={imageUrl}
                            onChange={(e) => {
                              setImageUrl(e.target.value);
                              setImgBroken(false);
                            }}
                            placeholder="https://…"
                          />
                        </div>
                      </label>
                    )}

                    {accountType === 'efectivo' && (
                      <label className="field">
                        <span className="field-label">Moneda</span>
                        <div className="type-toggle-row">
                          {EFECTIVO_OPTIONS.map((o) => (
                            <button
                              key={o.ticker}
                              type="button"
                              className={'type-toggle-btn' + (efectivoCurrency === o.ticker ? ' active' : '')}
                              onClick={() => setEfectivoCurrency(o.ticker)}
                            >
                              {o.name}
                            </button>
                          ))}
                        </div>
                      </label>
                    )}

                    {isEfectivo ? (
                      <div className={efectivoCurrency === 'USD' ? 'field-grid' : ''}>
                        <label className="field">
                          <span className="field-label">Monto ({efectivoCurrency})</span>
                          <input
                            className="mono"
                            value={addQty}
                            onChange={(e) => setAddQty(e.target.value)}
                            placeholder="0"
                          />
                        </label>
                        {efectivoCurrency === 'USD' && (
                          <label className="field">
                            <span className="field-label">Cotización blue (ARS)</span>
                            <input
                              className="mono"
                              value={efectivoPrice > 0 ? formatMoney(efectivoPrice, 'ARS') : 'Cargando…'}
                              readOnly
                            />
                          </label>
                        )}
                      </div>
                    ) : (
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
                          <span className="field-label">Precio de compra ({priceCurrency})</span>
                          <input
                            className="mono"
                            value={addPrice}
                            onChange={(e) => setAddPrice(e.target.value)}
                            placeholder="0"
                          />
                        </label>
                      </div>
                    )}

                    <div className="field-grid">
                      <label className="field">
                        <span className="field-label">Fecha</span>
                        <input
                          type="date"
                          className="mono"
                          value={opDate}
                          max={todayISODate()}
                          onChange={(e) => setOpDate(e.target.value)}
                        />
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
              </>
            )}
          </div>

          {/* summary */}
          <div className="asset-panel-summary">
            {isBilletera ? (
              <>
                <div className="summary-eyebrow">Posición resultante</div>
                <div className="ppc-card">
                  <div className="ppc-label">Saldo nuevo</div>
                  <div className="ppc-value">
                    {formatMoney(
                      fundBalance + (isWithdraw ? -depositAmountNum : depositAmountNum),
                      'ARS'
                    )}
                  </div>
                  <div className="ppc-before">
                    {isWithdraw ? `retiro: ${formatMoney(depositAmountNum, 'ARS')}` : `TNA: ${depositTna || '0'}%`}
                  </div>
                </div>
              </>
            ) : tab === 'venta' ? (
              <>
                <div className="summary-eyebrow">
                  Venta de {sellAsset?.ticker ?? '—'}
                </div>
                <div className="ppc-card">
                  <div className="ppc-label">Resultado realizado</div>
                  <div
                    className="ppc-value"
                    style={{ color: sellRealized >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                  >
                    {(sellRealized >= 0 ? '+' : '−') + formatMoney(Math.abs(sellRealized), sellCurrency)}
                  </div>
                  <div className="ppc-before">
                    {sellAsset
                      ? `PPC: ${formatMoney(sellAsset.avgPrice ?? 0, sellCurrency)}`
                      : 'elegí un activo'}
                  </div>
                </div>
                <div className="mini-grid">
                  <div className="mini-card">
                    <div className="mini-label">Cantidad restante</div>
                    <div className="mini-value">
                      {sellAsset ? formatQty(Math.max(0, (sellAsset.qty ?? 0) - sellQtyNum)) : '—'}
                    </div>
                  </div>
                  <div className="mini-card">
                    <div className="mini-label">Total venta</div>
                    <div className="mini-value">
                      {formatMoney(sellQtyNum * sellPriceNum, sellCurrency)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="summary-eyebrow">
                  Posición resultante en {selectedTicker || '—'}
                </div>
                <div className="ppc-card">
                  <div className="ppc-label">Precio promedio de compra (PPC)</div>
                  <div className="ppc-value">{formatMoney(calc.newAvgPrice, priceCurrency)}</div>
                  <div className="ppc-before">
                    {existingAsset
                      ? `antes: ${formatMoney(existingAsset.avgPrice, priceCurrency)} · ${formatQty(existingAsset.qty)} nominales`
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
                      {existingAsset ? ` (${formatMoney(existingAsset.currentPrice, priceCurrency)})` : ''}
                    </span>
                  </div>
                  <div className={'gp-value ' + (gp >= 0 ? 'positive' : 'negative')}>
                    {(gp >= 0 ? '+' : '−') + formatMoney(Math.abs(gp), priceCurrency)}
                    {calc.newInvested > 0
                      ? ` (${gp >= 0 ? '+' : '−'}${Math.abs(gpPct).toFixed(1).replace('.', ',')}%)`
                      : ''}
                  </div>
                </div>
                {existingAsset && existingAsset.history.length > 0 && (
                  <div className="history-box">
                    Historial de compras
                    <br />
                    <span className="history-lines">
                      {existingAsset.history.map((h, i) => (
                        <span key={i}>
                          {h.date} · {formatQty(h.qty)} × {formatMoney(h.price, priceCurrency)}
                          {i < existingAsset.history.length - 1 ? <br /> : null}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
