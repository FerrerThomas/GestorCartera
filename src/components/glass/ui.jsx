import { useEffect } from 'react';
import Icon from './Icon.jsx';

export const TABS = [
  { id: 'resumen', label: 'Resumen', icon: 'home' },
  { id: 'movimientos', label: 'Movimientos', icon: 'list' },
  { id: 'presupuesto', label: 'Presupuesto', icon: 'pie' },
  { id: 'cartera', label: 'Cartera', icon: 'chart' },
];

export function TabBar({ current, onChange, onNew }) {
  return (
    <div className="tabbar-wrap">
      <nav aria-label="Secciones" className="tabbar glass">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-current={current === t.id ? 'page' : undefined}
            onClick={() => onChange(t.id)}
          >
            <Icon name={t.icon} size={24} />
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
      <button type="button" className="fab glass tint" aria-label="Nuevo movimiento" onClick={onNew}>
        <Icon name="plus" size={28} stroke={2.4} />
        <span className="fab-label">Nuevo movimiento</span>
      </button>
    </div>
  );
}

// Línea + área a partir de una serie de números (se escala al alto disponible).
export function Sparkline({ values, height = 64, color = '#fff', fillOpacity = 0.12, className, style, label }) {
  if (!values || values.length < 2) return null;
  const W = 320;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 6;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      <path d={`${line} L${W} ${height} L0 ${height} Z`} fill={color} fillOpacity={fillOpacity} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Segmented({ options, value, onChange, label, className = '', glass = 'glass' }) {
  return (
    <div role="group" aria-label={label} className={`segmented ${glass} ${className}`}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return undefined;
    const id = setTimeout(onDone, 3200);
    return () => clearTimeout(id);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="toast glass" role="status">
      {message}
    </div>
  );
}

// Hoja de acción estilo iOS: mensaje + acciones + Cancelar.
export function ActionSheet({ message, actions, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-overlay" onMouseDown={onClose}>
      <div className="action-sheet" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="action-group">
          {message && <div className="action-msg">{message}</div>}
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.danger ? 'danger' : undefined}
              onClick={() => {
                onClose();
                a.onSelect();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="action-group">
          <button type="button" className="bold" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export function MigrationBanner() {
  return (
    <div className="banner warn" role="note">
      <Icon name="warning" size={20} stroke={2.2} style={{ flex: 'none', marginTop: 1 }} />
      <span>
        Para usar gastos, ingresos y presupuestos falta correr <strong>supabase/migrations/006_movements.sql</strong> en
        el SQL Editor de Supabase.
      </span>
    </div>
  );
}

export function Progress({ ratio, color, pace }) {
  return (
    <div className="progress" aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, background: color }} />
      {pace != null && pace > 0 && pace < 1 && <i className="pace" style={{ left: `${pace * 100}%` }} />}
    </div>
  );
}

// "Hoy", "Ayer", "Domingo 9".
export function dayLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - date) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const s = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });
  return s[0].toUpperCase() + s.slice(1);
}

export function todayLong() {
  const s = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s[0].toUpperCase() + s.slice(1);
}
