import { ACCOUNT_DOT_COLOR } from '../data/initialData.js';
import { formatMoney } from '../utils/finance.js';

export default function Sidebar({ accounts, accountBalances, onConnectAccount }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div className="brand-name">Mi Portfolio</div>
      </div>

      <nav className="nav">
        <button className="nav-item active">Resumen</button>
        <button className="nav-item">Activos</button>
        <button className="nav-item">Movimientos</button>
        <button className="nav-item">Análisis</button>
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="section-label">Cuentas conectadas</div>
        <div className="accounts-list">
          {accounts.map((acc) => (
            <div className="account-row" key={acc.id}>
              <div className="account-row-left">
                <span
                  className="account-dot"
                  style={{ background: ACCOUNT_DOT_COLOR[acc.type] }}
                />
                <span className="account-name">{acc.name}</span>
              </div>
              <span className="account-balance">
                {formatMoney(accountBalances[acc.id] ?? 0, acc.currency)}
              </span>
            </div>
          ))}
        </div>
        <button className="btn-dashed" onClick={onConnectAccount}>
          + Conectar cuenta
        </button>
      </div>
    </aside>
  );
}
