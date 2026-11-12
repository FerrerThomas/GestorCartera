import { useMemo } from 'react';
import Icon, { CategoryDot, accountColor, accountTypeLabel, categoryStyle } from '../components/glass/Icon.jsx';
import { MigrationBanner, Segmented, Sparkline, dayLabel } from '../components/glass/ui.jsx';
import { currentMonthKey, monthLabel, monthProgress } from '../hooks/useMovements.js';
import { assetValueARS, formatAmount, formatMoney, formatPct } from '../utils/finance.js';
import { describeMovement } from './MovimientosScreen.jsx';
import AccountIcon from '../components/glass/AccountIcon.jsx';

const DIST_COLORS = {
  CEDEAR: '#0071E3',
  Acción: '#5856D6',
  Cripto: '#E0A100',
  'Fondo money market': '#34C759',
  Efectivo: '#30B0C7',
  'Skin CS2': '#AF52DE',
};
const DIST_LABEL = {
  CEDEAR: 'CEDEARs',
  Acción: 'Acciones',
  Cripto: 'Cripto',
  'Fondo money market': 'Billeteras',
  Efectivo: 'Efectivo',
  'Skin CS2': 'Skins CS2',
};

function initials(email) {
  const name = String(email ?? '').split('@')[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function ResumenScreen({
  userEmail,
  currency,
  onSetCurrency,
  totalARS,
  usdArs,
  history,
  accounts,
  assets,
  accountBalances,
  month,
  recentMovements = [],
  categories,
  missingMigration,
  onNew,
  onOpenSettings,
  onOpenHistory,
  onGoto,
}) {
  const conv = (v) => (currency === 'USD' ? v / usdArs : v);
  const fmt = (v) => formatMoney(conv(v), currency);

  // Variación del mes contra la última foto anterior al día 1.
  const delta = useMemo(() => {
    if (!history.length) return null;
    const monthStart = `${currentMonthKey()}-01`;
    const before = history.filter((h) => h.snapshot_date < monthStart);
    const base = before.length ? before[before.length - 1] : history[0];
    const baseVal =
      currency === 'USD' ? Number(base.total_usd ?? base.total_ars / usdArs) : Number(base.total_ars);
    const now = conv(totalARS);
    if (!baseVal) return null;
    return { abs: now - baseVal, pct: ((now - baseVal) / baseVal) * 100 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, currency, totalARS, usdArs]);

  const spark = useMemo(() => {
    const pts = history
      .slice(-30)
      .map((h) => (currency === 'USD' ? Number(h.total_usd ?? h.total_ars / usdArs) : Number(h.total_ars)));
    pts.push(conv(totalARS));
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, currency, totalARS, usdArs]);

  const expenseCats = categories.filter((c) => c.kind === 'expense' && !c.archived);
  const cap = expenseCats.reduce((s, c) => s + (c.monthly_budget ?? 0), 0);
  const { left } = monthProgress(currentMonthKey());
  const remaining = cap - month.expenses;
  const segments = Object.entries(month.byCategory)
    .map(([id, v]) => ({ id, v, cat: categories.find((c) => c.id === id) }))
    .sort((a, b) => b.v - a.v);
  const barBase = Math.max(cap, month.expenses, 1);

  const assetCount = (accId) => assets.filter((a) => a.accountId === accId).length;

  const distribution = useMemo(() => {
    const by = {};
    for (const a of assets) by[a.category] = (by[a.category] ?? 0) + assetValueARS(a, usdArs);
    const total = Object.values(by).reduce((x, y) => x + y, 0) || 1;
    return Object.entries(by)
      .map(([cat, v]) => ({ cat, v, pct: (v / total) * 100 }))
      .sort((a, b) => b.v - a.v);
  }, [assets, usdArs]);

  return (
    <div className="screen">
      <section className="hero" style={{ '--hero': 'var(--hero-resumen)' }} aria-label="Patrimonio">
        <Sparkline values={spark} height={100} className="hero-bg" />
        <header className="hero-head">
          <h1 className="large-title">Resumen</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="icon-btn glass clear" aria-label="Historial de cambios" onClick={onOpenHistory}>
              <Icon name="clock" size={20} />
            </button>
            <button type="button" className="icon-btn glass clear" aria-label="Ajustes" onClick={onOpenSettings}>
              {initials(userEmail)}
            </button>
          </div>
        </header>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <span className="hero-label">Patrimonio total</span>
          <Segmented
            label="Moneda"
            className="on-hero small"
            glass="glass clear"
            value={currency}
            onChange={onSetCurrency}
            options={[
              { value: 'ARS', label: 'ARS' },
              { value: 'USD', label: 'USD' },
            ]}
          />
        </div>
        <div className="hero-big">{fmt(totalARS)}</div>
        {delta && (
          <div className="hero-sub">
            {(delta.abs >= 0 ? '+' : '−') + formatMoney(Math.abs(delta.abs), currency)} ({formatPct(delta.pct)}){' '}
            <span className="muted">este mes</span>
          </div>
        )}

        <nav className="quick-actions" aria-label="Acciones rápidas" style={{ marginTop: 112 }}>
          <button type="button" className="glass clear" onClick={() => onNew('expense')}>
            <Icon name="minus" size={18} stroke={2.6} /> Gasto
          </button>
          <button type="button" className="glass clear" onClick={() => onNew('income')}>
            <Icon name="plus" size={18} stroke={2.6} /> Ingreso
          </button>
          <button type="button" className="glass clear" onClick={() => onNew('transfer')}>
            <Icon name="swap" size={18} stroke={2.3} /> Mover
          </button>
        </nav>
      </section>

      {missingMigration && (
        <div className="content" style={{ paddingBottom: 0 }}>
          <MigrationBanner />
        </div>
      )}
      <div className="content dash">
        <button type="button" className="card area-month" onClick={() => onGoto('presupuesto')} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>{monthLabel(currentMonthKey())}</span>
            <span style={{ fontSize: 15, color: 'var(--label-2)' }}>
              {left} día{left === 1 ? '' : 's'} restante{left === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="stat-label">Gastos del mes</span>
              <span className="stat-value">{fmt(month.expenses)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="stat-label">Ingresos del mes</span>
              <span className="stat-value amount-in">{fmt(month.income)}</span>
            </div>
          </div>
          <div className="stack-bar" aria-hidden="true">
            {segments.map((s) => (
              <span key={s.id} style={{ width: `${(s.v / barBase) * 100}%`, background: categoryStyle(s.cat).color }} />
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--label-2)' }}>
            {cap > 0 ? (
              remaining >= 0 ? (
                <>
                  Te quedan <strong style={{ color: 'var(--label)' }}>{fmt(remaining)}</strong> de {fmt(cap)}
                  {left > 0 && <> · ~{fmt(remaining / left)} por día</>}
                </>
              ) : (
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>Te pasaste {fmt(-remaining)} del tope de {fmt(cap)}</span>
              )
            ) : (
              'Definí presupuestos por categoría para ver cuánto te queda'
            )}
          </div>
        </button>

        <section className="area-accounts" aria-labelledby="h-cuentas" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id="h-cuentas" className="section-title">
            Cuentas
          </h2>
          {accounts.length === 0 ? (
            <div className="card empty">
              Todavía no tenés cuentas.{' '}
              <button type="button" className="capsule-btn plain" onClick={onOpenSettings} style={{ marginTop: 10 }}>
                Agregar cuenta
              </button>
            </div>
          ) : (
            <ul className="list">
              {accounts.map((acc) => (
                <li key={acc.id}>
                  <button type="button" className="row" onClick={() => onGoto('cartera', { accountId: acc.id })}>
                    <AccountIcon account={acc} size={36} />
                    <span className="row-body">
                      <span className="row-main">
                        <span className="row-title">{acc.name}</span>
                        <span className="row-sub">
                          {accountTypeLabel(acc)} · {assetCount(acc.id)} activo{assetCount(acc.id) === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="row-value">{fmt(accountBalances[acc.id] ?? 0)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="area-recent desk-only" aria-labelledby="h-recent">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 6px 8px' }}>
            <h2 id="h-recent" className="section-title" style={{ margin: 0 }}>
              Últimos movimientos
            </h2>
            <button type="button" className="capsule-btn plain" style={{ minHeight: 32, padding: '0 12px', fontSize: 14 }} onClick={() => onGoto('movimientos')}>
              Ver todos
            </button>
          </div>
          {recentMovements.length === 0 ? (
            <div className="card empty">Todavía no hay movimientos este mes.</div>
          ) : (
            <ul className="list">
              {recentMovements.map((m) => {
                const d = describeMovement(m, categories, accounts);
                return (
                  <li key={m.id}>
                    <div className="row">
                      {m.type === 'transfer' ? (
                        <span className="dot-icon sm" aria-hidden="true" style={{ background: '#8E8E93' }}>
                          <Icon name="swap" size={16} stroke={2.2} />
                        </span>
                      ) : (
                        <CategoryDot category={d.cat} size={32} />
                      )}
                      <span className="row-body">
                        <span className="row-main">
                          <span className="row-title" style={{ fontSize: 15 }}>{d.title}</span>
                          <span className="row-sub">{dayLabel(m.occurred_on)} · {d.sub}</span>
                        </span>
                        <span
                          className={`row-value ${m.type === 'income' ? 'amount-in' : m.type === 'transfer' ? 'amount-move' : ''}`}
                          style={{ fontSize: 15, fontWeight: 500 }}
                        >
                          {m.type === 'income' ? '+' : m.type === 'expense' ? '−' : ''}
                          {formatAmount(m.amount, m.currency)}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card area-dist desk-only" aria-labelledby="h-dist" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 id="h-dist" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            Distribución
          </h2>
          <div className="stack-bar" aria-hidden="true" style={{ height: 12, borderRadius: 6 }}>
            {distribution.map((d) => (
              <span key={d.cat} style={{ width: `${d.pct}%`, background: DIST_COLORS[d.cat] ?? '#8E8E93' }} />
            ))}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {distribution.map((d) => (
              <li key={d.cat} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: DIST_COLORS[d.cat] ?? '#8E8E93', flex: 'none' }} />
                <span style={{ flex: 1 }}>{DIST_LABEL[d.cat] ?? d.cat}</span>
                <span className="num" style={{ color: 'var(--label-2)' }}>{fmt(d.v)}</span>
                <span className="num" style={{ width: 52, textAlign: 'right', fontWeight: 600 }}>
                  {d.pct.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
