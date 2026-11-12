import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { Segmented } from './ui.jsx';
import { fmtTna } from './AddAccountSheet.jsx';
import { findWallet } from '../../data/logos.js';
import { formatMoney, parseLocaleNumber } from '../../utils/finance.js';

// Cómo rinde una billetera: siguiendo un FCI (cuotapartes), con la tasa que
// publica la entidad, o con TNA manual.
export default function YieldSheet({ account, fund, fciQuotes, walletRates, onClose, onSave }) {
  const preset = findWallet(account.name);
  const initialMode = account.fund_fci ? 'fci' : account.fund_api ? 'api' : 'manual';
  const [mode, setMode] = useState(initialMode);
  const [fci, setFci] = useState(account.fund_fci ?? preset?.fci ?? null);
  const [api, setApi] = useState(account.fund_api ?? preset?.api ?? null);
  const [tna, setTna] = useState(fund?.tna ? String(fund.tna).replace('.', ',') : '');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fundList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(fciQuotes)
      .filter(([name, v]) => v.tna != null && v.tna > 0 && v.tna < 200 && !/d[oó]lar|usd/i.test(name))
      .filter(([name]) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => (a[0] === preset?.fci ? -1 : b[0] === preset?.fci ? 1 : a[0].localeCompare(b[0])))
      .slice(0, 60);
  }, [fciQuotes, query, preset]);

  const selectedQuote = fci ? fciQuotes[fci] : null;
  const valid =
    mode === 'fci' ? !!selectedQuote?.vcp : mode === 'api' ? !!api && walletRates[api] != null : parseLocaleNumber(tna) >= 0;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const cfg =
      mode === 'fci'
        ? { fci, api: null, vcp: selectedQuote.vcp, vcpDate: selectedQuote.fecha, tna: selectedQuote.tna, currentValue: fund?.value }
        : mode === 'api'
          ? { fci: null, api, tna: walletRates[api] }
          : { fci: null, api: null, tna: parseLocaleNumber(tna) };
    const ok = await onSave(cfg);
    if (ok) onClose();
    else setBusy(false);
  };

  return (
    <div className="sheet-overlay" onMouseDown={onClose}>
      <div className="sheet tall" role="dialog" aria-modal="true" aria-labelledby="y-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="sheet-head">
          <button type="button" className="icon-btn glass" aria-label="Cancelar" onClick={onClose}>
            <Icon name="close" size={18} stroke={2.6} />
          </button>
          <h1 id="y-title" className="sheet-title">
            Rendimiento de {account.name}
          </h1>
          <button type="button" className="icon-btn glass tint" aria-label="Guardar" onClick={save} disabled={!valid || busy} style={{ opacity: valid && !busy ? 1 : 0.45 }}>
            <Icon name="check" size={20} stroke={2.8} />
          </button>
        </header>

        <div className="sheet-body">
          <Segmented
            label="Cómo rinde"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'fci', label: 'Fondo' },
              { value: 'api', label: 'Tasa' },
              { value: 'manual', label: 'Manual' },
            ]}
          />

          {mode === 'fci' && (
            <>
              <p className="footnote" style={{ margin: '12px 24px 0' }}>
                Cada depósito compra cuotapartes y el saldo sigue el valor diario del fondo, como en la app real.
                {fund && fund.value > 0 && <> Tu saldo actual ({formatMoney(fund.value, 'ARS')}) se convierte a cuotapartes al valor de hoy.</>}
              </p>
              <div style={{ margin: '12px 16px 8px', position: 'relative' }}>
                <Icon name="search" size={17} stroke={2.2} color="var(--label-2)" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  className="text-input"
                  type="search"
                  style={{ paddingLeft: 36 }}
                  placeholder="Buscar fondo (ej: Mercado Fondo)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar fondo"
                />
              </div>
              <ul className="list search-results" style={{ maxHeight: 360 }} role="radiogroup" aria-label="Fondos money market">
                {Object.keys(fciQuotes).length === 0 && <li className="empty">Cargando fondos…</li>}
                {fundList.map(([name, v]) => (
                  <li key={name}>
                    <button type="button" className="row" role="radio" aria-checked={fci === name} onClick={() => setFci(name)} style={{ minHeight: 52 }}>
                      <span className="row-body">
                        <span className="row-main">
                          <span className="row-title" style={{ fontSize: 15, fontWeight: fci === name ? 700 : 400 }}>
                            {name}
                          </span>
                          <span className="row-sub">
                            {name === preset?.fci && <span className="yield-badge">{preset.name}</span>}
                            Cuotaparte al {v.fecha.split('-').reverse().join('/')}
                          </span>
                        </span>
                        <span className="row-value num" style={{ fontSize: 15 }}>
                          {fmtTna(v.tna)}
                        </span>
                        {fci === name && <Icon name="check" size={18} stroke={2.6} color="var(--tint)" />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {mode === 'api' && (
            <ul className="list" style={{ marginTop: 14 }} role="radiogroup" aria-label="Entidades">
              {Object.keys(walletRates).length === 0 && <li className="empty">Cargando tasas…</li>}
              {Object.entries(walletRates).map(([entity, rate]) => (
                <li key={entity}>
                  <button type="button" className="row" role="radio" aria-checked={api === entity} onClick={() => setApi(entity)} style={{ minHeight: 50 }}>
                    <span className="row-body">
                      <span className="row-main">
                        <span className="row-title" style={{ textTransform: 'capitalize', fontWeight: api === entity ? 700 : 400 }}>
                          {entity}
                        </span>
                      </span>
                      <span className="row-value num">{fmtTna(rate)}</span>
                      {api === entity && <Icon name="check" size={18} stroke={2.6} color="var(--tint)" />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {mode === 'manual' && (
            <>
              <ul className="form-list" style={{ marginTop: 14 }}>
                <li>
                  <label className="form-row">
                    <span>TNA %</span>
                    <input inputMode="decimal" placeholder="0" value={tna} onChange={(e) => setTna(e.target.value)} style={{ color: 'var(--label)' }} />
                  </label>
                </li>
              </ul>
              <p className="footnote" style={{ margin: '8px 24px 0' }}>
                El interés se calcula con esta tasa desde cada depósito. Si la tasa cambia, cambia también para los días ya pasados.
              </p>
            </>
          )}

          <div style={{ margin: '16px 16px 8px' }}>
            <button type="button" className="glass tint capsule-btn" style={{ width: '100%', minHeight: 52, opacity: valid && !busy ? 1 : 0.45 }} disabled={!valid || busy} onClick={save}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
