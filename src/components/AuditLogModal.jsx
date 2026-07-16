import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const ACTION_COLOR = {
  account_created: 'var(--accent)',
  account_deleted: 'var(--negative)',
  asset_created: 'var(--accent)',
  asset_bought: 'var(--accent)',
  asset_deleted: 'var(--negative)',
  fund_created: 'var(--blue)',
  fund_deposit: 'var(--blue)',
  asset_sold: 'var(--orange)',
  fund_withdrawal: 'var(--orange)',
};

function formatDateTime(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('es-AR');
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export default function AuditLogModal({ onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id, action, description, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setEntries(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Movimientos</div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ padding: '12px 24px 24px', maxHeight: 480, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '20px 0' }}>
              Cargando…
            </div>
          ) : entries.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '20px 0' }}>
              Todavía no hay movimientos registrados.
            </div>
          ) : (
            entries.map((e) => (
              <div className="audit-row" key={e.id}>
                <span
                  className="audit-dot"
                  style={{ background: ACTION_COLOR[e.action] ?? 'var(--text-faint)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="audit-desc">{e.description}</div>
                  <div className="audit-date">{formatDateTime(e.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
