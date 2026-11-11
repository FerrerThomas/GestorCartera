import { useState } from 'react';
import Icon, { CategoryDot, categoryStyle } from '../components/glass/Icon.jsx';
import { MigrationBanner, Progress } from '../components/glass/ui.jsx';
import {
  currentMonthKey,
  monthLabel,
  monthProgress,
  movementActions,
  shiftMonth,
  summarizeMonth,
  useMonthMovements,
} from '../hooks/useMovements.js';
import { formatMoney, parseLocaleNumber } from '../utils/finance.js';

function Ring({ ratio }) {
  const C = 2 * Math.PI * 50;
  const shown = Math.min(1, Math.max(0, ratio));
  return (
    <svg width="124" height="124" viewBox="0 0 120 120" role="img" aria-label={`Usaste el ${Math.round(ratio * 100)}% del tope`} style={{ flex: 'none' }}>
      <circle cx="60" cy="60" r="50" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="14" />
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke={ratio > 1 ? '#ff6961' : '#fff'}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${(shown * C).toFixed(1)} ${C.toFixed(1)}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="58" textAnchor="middle" fontSize="26" fontWeight="700" fill="#fff">
        {Math.round(ratio * 100)}%
      </text>
      <text x="60" y="77" textAnchor="middle" fontSize="12" fill="#fff" fillOpacity="0.85">
        del tope
      </text>
    </svg>
  );
}

export default function PresupuestosScreen({ user, categories, missingCategories, version, usdArs, onChanged, onToast }) {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [newCat, setNewCat] = useState({ name: '', emoji: '' });
  const { movements, missing } = useMonthMovements(user, monthKey, version);
  const summary = summarizeMonth(movements, usdArs);
  const isCurrent = monthKey === currentMonthKey();
  const { left, elapsed } = monthProgress(monthKey);

  const expenseCats = categories.filter((c) => c.kind === 'expense' && !c.archived);
  const budgeted = expenseCats.filter((c) => c.monthly_budget);
  const unbudgeted = expenseCats.filter((c) => !c.monthly_budget);
  const cap = budgeted.reduce((s, c) => s + c.monthly_budget, 0);
  const spent = summary.expenses;
  const ratio = cap ? spent / cap : 0;
  const remaining = cap - spent;
  const fast = isCurrent && cap > 0 && spent > cap * elapsed * 1.05 && remaining > 0;

  const saveBudget = async (cat) => {
    const raw = drafts[cat.id];
    if (raw == null) return;
    const value = parseLocaleNumber(raw);
    if ((cat.monthly_budget ?? 0) === value) return;
    try {
      await movementActions.setBudget(cat.id, value);
      onChanged();
    } catch (e) {
      onToast(e.message);
    }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    try {
      await movementActions.addCategory(user.id, { ...newCat, kind: 'expense', sortOrder: expenseCats.length + 1 });
      setNewCat({ name: '', emoji: '' });
      onChanged();
    } catch (err) {
      onToast(err.message);
    }
  };

  const archive = async (cat) => {
    try {
      await movementActions.archiveCategory(cat.id);
      onChanged();
    } catch (err) {
      onToast(err.message);
    }
  };

  const missingAny = missing || missingCategories;

  return (
    <div className="screen">
      <section className="hero" style={{ '--hero': 'var(--hero-presupuesto)', gap: 16 }} aria-label="Resumen del mes">
        <header className="hero-head">
          <h1 className="large-title">Presupuesto</h1>
          <button
            type="button"
            className="capsule-btn glass clear"
            onClick={() => {
              setEditing((v) => !v);
              setDrafts({});
            }}
            disabled={missingAny}
          >
            {editing ? 'Listo' : 'Editar'}
          </button>
        </header>

        <div className="glass clear" role="group" aria-label="Mes" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', borderRadius: 20, height: 40 }}>
          <button type="button" className="icon-btn" style={{ width: 40, height: 40 }} aria-label="Mes anterior" onClick={() => setMonthKey(shiftMonth(monthKey, -1))}>
            <Icon name="chevronLeft" size={16} stroke={2.6} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, padding: '0 4px' }}>{monthLabel(monthKey, true)}</span>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 40, height: 40, opacity: isCurrent ? 0.4 : 1 }}
            aria-label="Mes siguiente"
            disabled={isCurrent}
            onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
          >
            <Icon name="chevronRight" size={16} stroke={2.6} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Ring ratio={ratio} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span className="hero-label">Gastado</span>
            <span className="hero-big" style={{ fontSize: 30, lineHeight: '36px' }}>
              {formatMoney(spent, 'ARS')}
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
              {cap > 0 ? `de ${formatMoney(cap, 'ARS')}` : 'Sin tope definido'}
              {isCurrent && ` · ${left} día${left === 1 ? '' : 's'} restante${left === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        {fast && (
          <div className="glass clear banner" role="note" style={{ alignItems: 'center' }}>
            <Icon name="warning" size={20} stroke={2.2} color="#FFD60A" style={{ flex: 'none' }} />
            <span>
              Vas rápido: gastá hasta <strong>{formatMoney(remaining / Math.max(1, left), 'ARS')} por día</strong> para llegar.
            </span>
          </div>
        )}
        {cap > 0 && remaining < 0 && (
          <div className="glass clear banner" role="note" style={{ alignItems: 'center' }}>
            <Icon name="warning" size={20} stroke={2.2} color="#FF6961" style={{ flex: 'none' }} />
            <span>
              Te pasaste <strong>{formatMoney(-remaining, 'ARS')}</strong> del tope del mes.
            </span>
          </div>
        )}
      </section>

      <div className="content">
        {missingAny && <MigrationBanner />}

        {!missingAny && (
          <>
            <h2 className="section-caption">{editing ? 'Presupuesto mensual por categoría (ARS)' : 'Por categoría'}</h2>
            {editing ? (
              <ul className="list">
                {expenseCats.map((c) => (
                  <li key={c.id}>
                    <div className="row">
                      <CategoryDot category={c} size={36} />
                      <span className="row-body">
                        <span className="row-main">
                          <span className="row-title">{c.name}</span>
                        </span>
                        <input
                          className="text-input"
                          style={{ width: 130, textAlign: 'right' }}
                          inputMode="decimal"
                          placeholder="Sin tope"
                          aria-label={`Presupuesto de ${c.name}`}
                          value={drafts[c.id] ?? (c.monthly_budget ? String(c.monthly_budget).replace('.', ',') : '')}
                          onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                          onBlur={() => saveBudget(c)}
                          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        />
                        <button type="button" className="icon-btn" aria-label={`Ocultar ${c.name}`} onClick={() => archive(c)} style={{ color: 'var(--red)' }}>
                          <Icon name="trash" size={19} />
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
                <li>
                  <form className="row" onSubmit={addCategory}>
                    <input
                      className="text-input"
                      style={{ width: 56, textAlign: 'center' }}
                      maxLength={4}
                      placeholder="🙂"
                      aria-label="Emoji de la categoría"
                      value={newCat.emoji}
                      onChange={(e) => setNewCat((n) => ({ ...n, emoji: e.target.value }))}
                    />
                    <span className="row-body">
                      <input
                        className="text-input"
                        placeholder="Nueva categoría"
                        aria-label="Nombre de la nueva categoría"
                        value={newCat.name}
                        maxLength={30}
                        onChange={(e) => setNewCat((n) => ({ ...n, name: e.target.value }))}
                      />
                      <button type="submit" className="capsule-btn plain" disabled={!newCat.name.trim()}>
                        Agregar
                      </button>
                    </span>
                  </form>
                </li>
              </ul>
            ) : budgeted.length === 0 ? (
              <div className="card empty">
                Todavía no definiste presupuestos.
                <div>
                  <button type="button" className="capsule-btn plain" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>
                    Definir presupuestos
                  </button>
                </div>
              </div>
            ) : (
              <ul className="list">
                {budgeted.map((c) => {
                  const s = summary.byCategory[c.id] ?? 0;
                  const r = s / c.monthly_budget;
                  const over = r > 1;
                  const warn = !over && r >= 0.8;
                  return (
                    <li key={c.id}>
                      <div className="row">
                        <CategoryDot category={c} size={36} />
                        <span className="row-body" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 7, padding: '12px 16px 12px 0' }}>
                          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 17 }}>{c.name}</span>
                            <span
                              className="num"
                              style={{
                                fontSize: 15,
                                color: over ? 'var(--red)' : warn ? 'var(--orange)' : 'var(--label-2)',
                                fontWeight: over || warn ? 600 : 400,
                              }}
                            >
                              {over ? `+${formatMoney(s - c.monthly_budget, 'ARS')}` : `quedan ${formatMoney(c.monthly_budget - s, 'ARS')}`}
                            </span>
                          </span>
                          <Progress ratio={r} color={over ? '#FF3B30' : warn ? '#FF9500' : categoryStyle(c).color} pace={isCurrent ? elapsed : null} />
                          <span style={{ fontSize: 13, color: 'var(--label-2)' }} className="num">
                            {formatMoney(s, 'ARS')} de {formatMoney(c.monthly_budget, 'ARS')}
                          </span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {!editing && unbudgeted.some((c) => summary.byCategory[c.id]) && (
              <>
                <h2 className="section-caption">Sin presupuesto</h2>
                <ul className="list">
                  {unbudgeted
                    .filter((c) => summary.byCategory[c.id])
                    .map((c) => (
                      <li key={c.id}>
                        <div className="row">
                          <CategoryDot category={c} size={32} />
                          <span className="row-body">
                            <span className="row-main">
                              <span className="row-title">{c.name}</span>
                            </span>
                            <span className="row-value">{formatMoney(summary.byCategory[c.id], 'ARS')}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                </ul>
              </>
            )}
            {!editing && isCurrent && budgeted.length > 0 && (
              <p className="footnote">La marca gris en cada barra es el ritmo ideal a hoy. Lo gastado en dólares se cuenta al blue.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
