import { useState } from 'react';
import Icon, { CategoryDot } from '../components/glass/Icon.jsx';
import { MigrationBanner, Segmented, dayLabel } from '../components/glass/ui.jsx';
import { currentMonthKey, monthLabel, shiftMonth } from '../hooks/useMovements.js';
import { formatAmount, formatMoney } from '../utils/finance.js';

const TYPE_LABEL = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia' };

export function describeMovement(m, categories, accounts) {
  const cat = categories.find((c) => c.id === m.category_id);
  const acc = (id) => accounts.find((a) => a.id === id)?.name ?? 'Cuenta borrada';
  if (m.type === 'transfer') {
    return {
      cat: null,
      title: m.note || `${acc(m.from_account_id)} → ${acc(m.to_account_id)}`,
      sub: m.note ? `${acc(m.from_account_id)} → ${acc(m.to_account_id)}` : 'Transferencia',
    };
  }
  const account = acc(m.type === 'income' ? m.to_account_id : m.from_account_id);
  return {
    cat,
    title: m.note || cat?.name || TYPE_LABEL[m.type],
    sub: m.note && cat ? `${cat.name} · ${account}` : account,
  };
}

export default function MovimientosScreen({
  monthKey,
  onChangeMonth,
  movements,
  summary,
  categories,
  accounts,
  loading,
  missingMigration,
  onNew,
  onSelectMovement,
}) {
  const [filter, setFilter] = useState('all');
  const isCurrent = monthKey === currentMonthKey();

  const visible = movements.filter((m) => filter === 'all' || m.type === filter);
  const days = [];
  for (const m of visible) {
    const last = days[days.length - 1];
    if (last && last.date === m.occurred_on) last.items.push(m);
    else days.push({ date: m.occurred_on, items: [m] });
  }

  return (
    <div className="screen">
      <section className="hero" style={{ '--hero': 'var(--hero-movimientos)', gap: 14 }} aria-label="Movimientos del mes">
        <header className="hero-head">
          <h1 className="large-title">Movimientos</h1>
          <button type="button" className="icon-btn glass clear" aria-label="Nuevo movimiento" onClick={() => onNew('expense')}>
            <Icon name="plus" size={20} stroke={2.3} />
          </button>
        </header>

        <div className="glass clear" role="group" aria-label="Mes" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', borderRadius: 20, height: 40 }}>
          <button type="button" className="icon-btn" style={{ width: 40, height: 40 }} aria-label="Mes anterior" onClick={() => onChangeMonth(shiftMonth(monthKey, -1))}>
            <Icon name="chevronLeft" size={16} stroke={2.6} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, padding: '0 4px' }}>{monthLabel(monthKey, true)}</span>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 40, height: 40, opacity: isCurrent ? 0.4 : 1 }}
            aria-label="Mes siguiente"
            disabled={isCurrent}
            onClick={() => onChangeMonth(shiftMonth(monthKey, 1))}
          >
            <Icon name="chevronRight" size={16} stroke={2.6} />
          </button>
        </div>

        <div className="grid-2">
          <div className="stat glass clear">
            <span className="stat-label">Gastos del mes</span>
            <span className="stat-value">{formatMoney(summary.expenses, 'ARS')}</span>
          </div>
          <div className="stat glass clear">
            <span className="stat-label">Ingresos del mes</span>
            <span className="stat-value">{formatMoney(summary.income, 'ARS')}</span>
          </div>
        </div>

        <Segmented
          label="Filtrar"
          className="on-hero"
          glass="glass clear"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'expense', label: 'Gastos' },
            { value: 'income', label: 'Ingresos' },
          ]}
        />
      </section>

      <div className="content days-cols">
        {missingMigration && <MigrationBanner />}
        {!missingMigration && !loading && days.length === 0 && (
          <div className="card empty">
            {filter === 'all' ? 'No hay movimientos este mes.' : 'No hay movimientos con ese filtro.'}
            <div>
              <button type="button" className="capsule-btn plain" style={{ marginTop: 12 }} onClick={() => onNew('expense')}>
                Cargar un gasto
              </button>
            </div>
          </div>
        )}
        {days.map((day) => (
          <section key={day.date} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 className="section-caption">{dayLabel(day.date)}</h2>
            <ul className="list">
              {day.items.map((m) => {
                const d = describeMovement(m, categories, accounts);
                const amountClass = m.type === 'income' ? 'amount-in' : m.type === 'transfer' ? 'amount-move' : '';
                const sign = m.type === 'income' ? '+' : m.type === 'expense' ? '−' : '';
                return (
                  <li key={m.id}>
                    <button type="button" className="row" style={{ minHeight: 60 }} onClick={() => onSelectMovement(m)}>
                      {m.type === 'transfer' ? (
                        <span className="dot-icon" aria-hidden="true" style={{ background: '#8E8E93' }}>
                          <Icon name="swap" size={19} stroke={2.2} />
                        </span>
                      ) : (
                        <CategoryDot category={d.cat} />
                      )}
                      <span className="row-body">
                        <span className="row-main">
                          <span className="row-title">{d.title}</span>
                          <span className="row-sub">
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.sub}</span>
                            {m.source === 'shortcut' && (
                              <span className="badge-shortcut">
                                <Icon name="bolt" size={10} stroke={2.6} /> Atajo
                              </span>
                            )}
                          </span>
                        </span>
                        <span className={`row-value ${amountClass}`} style={{ fontWeight: 500 }}>
                          {sign}
                          {formatAmount(m.amount, m.currency)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
