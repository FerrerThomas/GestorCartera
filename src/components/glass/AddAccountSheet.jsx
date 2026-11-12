import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Segmented } from './ui.jsx';
import { POPULAR_BROKERS, POPULAR_EXCHANGES, POPULAR_WALLETS, getWalletLogoUrl } from '../../data/logos.js';

const TYPES = [
  { id: 'billetera', label: 'Billetera', desc: 'Mercado Pago, Ualá…', icon: 'wallet', color: '#0A84FF' },
  { id: 'broker', label: 'Broker', desc: 'Acciones y CEDEARs', icon: 'trend', color: '#5856D6' },
  { id: 'exchange', label: 'Exchange', desc: 'Cripto', icon: 'coin', color: '#E0A100' },
  { id: 'efectivo', label: 'Efectivo', desc: 'Pesos o dólares', icon: 'cash', color: '#34C759' },
  { id: 'steam', label: 'Steam', desc: 'Skins CS2', icon: 'game', color: '#3A3A3C' },
];

export const fmtTna = (t) => (t == null ? '—' : `${t.toFixed(1).replace('.', ',')}%`);

// Texto corto de cómo rinde una billetera.
export function walletYieldLabel(w, fciQuotes, walletRates) {
  if (w?.fci) {
    const q = fciQuotes[w.fci];
    return q?.tna != null ? `Fondo · ${fmtTna(q.tna)}` : 'Rinde como su fondo';
  }
  if (w?.api) {
    const r = walletRates[w.api];
    return r != null ? `Tasa · ${fmtTna(r)}` : 'Tasa automática';
  }
  return 'TNA manual';
}

export default function AddAccountSheet({ fciQuotes, walletRates, onClose, onCreate }) {
  const [type, setType] = useState('billetera');
  const [wallet, setWallet] = useState(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid = name.trim().length > 0;
  const submit = async (e) => {
    e?.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const w = type === 'billetera' && wallet?.name === name.trim() ? wallet : null;
    await onCreate({
      name: name.trim(),
      type,
      currency,
      fundFci: w?.fci ?? null,
      fundApi: w?.api ?? null,
    });
    setBusy(false);
  };

  const q = wallet?.fci ? fciQuotes[wallet.fci] : null;

  return (
    <div className="sheet-overlay" onMouseDown={onClose}>
      <form className="sheet tall" role="dialog" aria-modal="true" aria-labelledby="ac-title" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="sheet-head">
          <button type="button" className="icon-btn glass" aria-label="Cancelar" onClick={onClose}>
            <Icon name="close" size={18} stroke={2.6} />
          </button>
          <h1 id="ac-title" className="sheet-title">
            Nueva cuenta
          </h1>
          <button type="submit" className="icon-btn glass tint" aria-label="Crear cuenta" disabled={!valid || busy} style={{ opacity: valid && !busy ? 1 : 0.45 }}>
            <Icon name="check" size={20} stroke={2.8} />
          </button>
        </header>

        <div className="sheet-body">
          <h2 className="sheet-section-title" style={{ marginTop: 12 }}>
            Tipo
          </h2>
          <div className="type-tiles" role="radiogroup" aria-label="Tipo de cuenta">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={type === t.id}
                className="type-tile"
                onClick={() => {
                  setType(t.id);
                  setWallet(null);
                  setName('');
                  setCurrency(t.id === 'exchange' || t.id === 'steam' ? 'USD' : 'ARS');
                }}
              >
                <span className="dot-icon sm" style={{ background: t.color }} aria-hidden="true">
                  <Icon name={t.icon} size={17} stroke={2.1} />
                </span>
                <span className="type-tile-text">
                  <strong>{t.label}</strong>
                  <small>{t.desc}</small>
                </span>
              </button>
            ))}
          </div>

          {type === 'billetera' && (
            <>
              <h2 className="sheet-section-title">Elegí tu billetera</h2>
              <div className="wallet-tiles" role="radiogroup" aria-label="Billetera">
                {POPULAR_WALLETS.map((w) => {
                  const auto = !!(w.fci || w.api);
                  return (
                    <button
                      key={w.name}
                      type="button"
                      role="radio"
                      aria-checked={wallet?.name === w.name}
                      className="wallet-tile"
                      onClick={() => {
                        setWallet(w);
                        setName(w.name);
                        setCurrency('ARS');
                      }}
                    >
                      <img src={getWalletLogoUrl(w.name)} alt="" width={36} height={36} />
                      <span className="wallet-tile-name">{w.name}</span>
                      <span className={`wallet-tile-yield${auto ? ' auto' : ''}`}>{walletYieldLabel(w, fciQuotes, walletRates)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {(type === 'broker' || type === 'exchange') && (
            <>
              <h2 className="sheet-section-title">{type === 'broker' ? 'Elegí tu broker' : 'Elegí tu exchange'}</h2>
              <div className="wallet-tiles preset-tiles" role="radiogroup" aria-label={type === 'broker' ? 'Broker' : 'Exchange'}>
                {(type === 'broker' ? POPULAR_BROKERS : POPULAR_EXCHANGES).map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    role="radio"
                    aria-checked={name === b.name}
                    className="wallet-tile"
                    onClick={() => setName(b.name)}
                  >
                    <img src={getWalletLogoUrl(b.name)} alt="" width={36} height={36} />
                    <span className="wallet-tile-name">{b.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <ul className="form-list" style={{ marginTop: 14 }}>
            <li>
              <label className="form-row">
                <span>Nombre</span>
                <input
                  value={name}
                  placeholder={type === 'billetera' ? 'Otra billetera' : 'Ej: IOL, Binance…'}
                  onChange={(e) => setName(e.target.value)}
                  style={{ color: 'var(--label)' }}
                  maxLength={40}
                />
              </label>
            </li>
            <li>
              <div className="form-row">
                <span>Moneda</span>
                <span style={{ flex: 1 }} />
                <Segmented
                  label="Moneda principal"
                  className="small"
                  glass=""
                  value={currency}
                  onChange={setCurrency}
                  options={[
                    { value: 'ARS', label: 'ARS' },
                    { value: 'USD', label: 'USD' },
                  ]}
                />
              </div>
            </li>
          </ul>

          {type === 'billetera' && (
            <p className="footnote" style={{ margin: '10px 24px 0' }}>
              {wallet?.fci ? (
                <>
                  El saldo de {wallet.name} se va a seguir como el fondo real (<strong>{wallet.fci}</strong>): cada depósito compra
                  cuotapartes y el saldo se actualiza con el valor diario del fondo
                  {q?.tna != null && <> · TNA hoy {fmtTna(q.tna)}</>}.
                </>
              ) : wallet?.api ? (
                <>La TNA de {wallet.name} se actualiza sola todos los días con la tasa que publica la billetera.</>
              ) : (
                <>Para una billetera sin fondo conocido vas a cargar la TNA a mano. Después podés vincularla a un fondo desde Ajustes.</>
              )}
            </p>
          )}

          <div style={{ margin: '16px 16px 8px' }}>
            <button type="submit" className="glass tint capsule-btn" style={{ width: '100%', minHeight: 52, opacity: valid && !busy ? 1 : 0.45 }} disabled={!valid || busy}>
              {busy ? 'Creando…' : 'Crear cuenta'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
