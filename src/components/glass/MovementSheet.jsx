import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon, { categoryStyle } from './Icon.jsx';
import { Segmented } from './ui.jsx';
import { movementActions } from '../../hooks/useMovements.js';
import { formatAmount, formatMoney, todayISODate } from '../../utils/finance.js';

const TITLES = { expense: 'Nuevo gasto', income: 'Nuevo ingreso', transfer: 'Mover plata' };
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'];

// Cuenta "de uso diario" preferida: billetera/efectivo con saldo, si hay.
function preferredAccount(accounts, cashByAccount) {
  const daily = accounts.filter((a) => a.type === 'billetera' || a.type === 'efectivo');
  return (
    daily.find((a) => (cashByAccount[a.id]?.ARS ?? 0) > 0) ?? daily[0] ?? accounts[0] ?? null
  );
}

export default function MovementSheet({
  initialType = 'expense',
  accounts,
  categories,
  cashByAccount,
  usdArs,
  spentByCategory,
  onClose,
  onSaved,
}) {
  const preferred = preferredAccount(accounts, cashByAccount);
  const [type, setType] = useState(initialType);
  const [digits, setDigits] = useState('');
  const [currency, setCurrency] = useState(preferred?.currency ?? 'ARS');
  const [fromId, setFromId] = useState(preferred?.id ?? '');
  const [toId, setToId] = useState(
    initialType === 'transfer' ? accounts.find((a) => a.id !== preferred?.id)?.id ?? '' : preferred?.id ?? ''
  );
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [catId, setCatId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const kindCats = useMemo(
    () => categories.filter((c) => !c.archived && c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type]
  );
  useEffect(() => {
    if (type === 'transfer') setCatId(null);
    else if (!kindCats.some((c) => c.id === catId)) setCatId(kindCats[0]?.id ?? null);
  }, [type, kindCats, catId]);

  const amount = Number((digits || '0').replace(',', '.'));
  const parts = digits.split(',');
  const display =
    (currency === 'USD' ? 'US$' : '$') +
    (parts[0] || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.') +
    (parts.length > 1 ? ',' + parts[1] : '');

  const press = useCallback((k) => {
    setError('');
    setDigits((d) => {
      if (k === 'del') return d.slice(0, -1);
      if (k === ',') return d.includes(',') ? d : (d || '0') + ',';
      const [int, dec] = d.split(',');
      if (dec != null && dec.length >= 2) return d;
      if (dec == null && int.length >= 10) return d;
      return d === '0' ? k : d + k;
    });
  }, []);

  const mainAccountId = type === 'income' ? toId : fromId;
  const valid =
    amount > 0 &&
    !!mainAccountId &&
    (type !== 'transfer' || (!!toId && toId !== fromId)) &&
    !!date &&
    date <= todayISODate();

  const save = useCallback(async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      await movementActions.register({
        type,
        amount,
        currency,
        fromAccountId: type === 'income' ? null : fromId,
        toAccountId: type === 'expense' ? null : toId,
        categoryId: type === 'transfer' ? null : catId,
        note: note.trim(),
        date,
        usdRate: currency === 'USD' ? usdArs : null,
      });
      const cat = categories.find((c) => c.id === catId);
      const acc = (id) => accounts.find((a) => a.id === id)?.name ?? '';
      onSaved(
        type === 'transfer'
          ? `Movidos ${formatAmount(amount, currency)} · ${acc(fromId)} → ${acc(toId)}`
          : `${type === 'expense' ? 'Gasto' : 'Ingreso'} de ${formatAmount(amount, currency)}${cat ? ` en ${cat.name}` : ''}`
      );
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }, [valid, busy, type, amount, currency, fromId, toId, catId, note, date, usdArs, categories, accounts, onSaved]);

  // Teclado físico (escritorio): números, coma, borrar, Enter guarda, Esc cierra.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === ',' || e.key === '.') press(',');
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') save();
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, save, onClose]);

  // Texto de ayuda bajo el monto.
  const cat = categories.find((c) => c.id === catId);
  const available = (id) => cashByAccount[id]?.[currency] ?? 0;
  let hint = '';
  if (type === 'expense' && cat?.monthly_budget) {
    const left = cat.monthly_budget - (spentByCategory[cat.id] ?? 0) - (currency === 'USD' ? amount * usdArs : amount);
    hint =
      left >= 0
        ? `Quedarían ${formatMoney(left, 'ARS')} de ${cat.name}`
        : `Te pasarías ${formatMoney(-left, 'ARS')} en ${cat.name}`;
  } else if (type !== 'income' && fromId) {
    hint = `Disponible: ${formatAmount(available(fromId), currency)}`;
  }
  const overdraw = type !== 'income' && fromId && amount > available(fromId) + 0.005;

  const accountOptions = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name}
    </option>
  ));

  return (
    <div className="sheet-overlay" onMouseDown={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="mv-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="sheet-head">
          <button type="button" className="icon-btn glass" aria-label="Cancelar" onClick={onClose}>
            <Icon name="close" size={18} stroke={2.6} />
          </button>
          <h1 id="mv-title" className="sheet-title">
            {TITLES[type]}
          </h1>
          <button
            type="button"
            className="icon-btn glass tint"
            aria-label="Guardar"
            onClick={save}
            disabled={!valid || busy}
            style={{ opacity: valid && !busy ? 1 : 0.45 }}
          >
            <Icon name="check" size={20} stroke={2.8} />
          </button>
        </header>

        <div className="sheet-body">
          <Segmented
            label="Tipo de movimiento"
            value={type}
            onChange={(t) => {
              setType(t);
              setError('');
              if (t === 'transfer' && (!toId || toId === fromId)) {
                setToId(accounts.find((a) => a.id !== fromId)?.id ?? '');
              }
              if (t === 'income' && !toId) setToId(fromId);
            }}
            options={[
              { value: 'expense', label: 'Gasto' },
              { value: 'income', label: 'Ingreso' },
              { value: 'transfer', label: 'Mover' },
            ]}
          />

          <section className="amount-display" aria-label="Monto">
            <div className="amount-line">
              {type !== 'transfer' && (
                <span className="amount-sign" style={{ color: type === 'expense' ? 'var(--red)' : 'var(--green)' }}>
                  {type === 'expense' ? '−' : '+'}
                </span>
              )}
              <output className="amount-value" style={{ color: digits ? 'var(--label)' : 'var(--label-3)' }} aria-live="polite">
                {display}
              </output>
            </div>
            <div className="amount-meta">
              <button
                type="button"
                className="glass"
                aria-label={`Moneda: ${currency}. Cambiar`}
                onClick={() => setCurrency((c) => (c === 'ARS' ? 'USD' : 'ARS'))}
              >
                {currency}
              </button>
              <span style={{ color: overdraw ? 'var(--red)' : undefined }}>
                {overdraw ? 'Saldo insuficiente en esa cuenta' : hint}
              </span>
            </div>
          </section>

          {type !== 'transfer' && kindCats.length > 0 && (
            <div className="cat-strip" role="radiogroup" aria-label="Categoría">
              {kindCats.map((c) => {
                const st = categoryStyle(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={catId === c.id}
                    className="cat"
                    onClick={() => setCatId(c.id)}
                  >
                    <span className="cat-dot" style={{ background: st.color }}>
                      {st.icon ? <Icon name={st.icon} size={25} /> : st.emoji}
                    </span>
                    <span className="cat-name">{c.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <ul className="form-list">
            {type === 'transfer' ? (
              <>
                <li>
                  <label className="form-row">
                    <span>Desde</span>
                    <select
                      value={fromId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setFromId(id);
                        if (id === toId) setToId(accounts.find((a) => a.id !== id)?.id ?? '');
                      }}
                    >
                      {accountOptions}
                    </select>
                  </label>
                </li>
                <li>
                  <label className="form-row">
                    <span>Hacia</span>
                    <select value={toId} onChange={(e) => setToId(e.target.value)}>
                      {accounts.filter((a) => a.id !== fromId).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              </>
            ) : (
              <li>
                <label className="form-row">
                  <span>{type === 'income' ? 'Cuenta' : 'Pagado con'}</span>
                  <select
                    value={mainAccountId}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (type === 'income') setToId(id);
                      else setFromId(id);
                      const acc = accounts.find((a) => a.id === id);
                      if (acc) setCurrency(acc.currency);
                    }}
                  >
                    {accountOptions}
                  </select>
                </label>
              </li>
            )}
            <li>
              <label className="form-row">
                <span>Nota</span>
                <input
                  type="text"
                  value={note}
                  maxLength={120}
                  placeholder="Opcional"
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && save()}
                />
              </label>
            </li>
            <li>
              <label className="form-row">
                <span>Fecha</span>
                <input type="date" value={date} max={todayISODate()} onChange={(e) => setDate(e.target.value)} />
              </label>
            </li>
          </ul>

          {error && (
            <div className="sheet-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="keypad" role="group" aria-label="Teclado numérico">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className="key"
              aria-label={k === 'del' ? 'Borrar' : k === ',' ? 'Coma decimal' : k}
              onClick={() => press(k)}
            >
              {k === 'del' ? '⌫' : k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
