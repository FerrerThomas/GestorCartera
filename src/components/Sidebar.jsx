import { ACCOUNT_DOT_COLOR } from '../data/initialData.js';
import { convertAmount, formatMoney } from '../utils/finance.js';

export default function Sidebar({
  accounts,
  accountBalances,
  currency,
  usdArs,
  onConnectAccount,
  onAddAssetToAccount,
  onSignOut,
  userEmail,
}) {
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
        {accounts.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            Todavía no conectaste ninguna cuenta.
          </div>
        ) : (
          <div className="accounts-list">
            {accounts.map((acc) => (
              <button
                type="button"
                className="account-row"
                key={acc.id}
                onClick={() => onAddAssetToAccount(acc.id)}
                title={`Agregar activo a ${acc.name}`}
                style={{
                  width: '100%',
                  background: 'none',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                  textAlign: 'left',
                }}
              >
                <div className="account-row-left">
                  <span
                    className="account-dot"
                    style={{ background: ACCOUNT_DOT_COLOR[acc.type] }}
                  />
                  <span className="account-name">{acc.name}</span>
                </div>
                <span className="account-balance">
                  {formatMoney(
                    convertAmount(accountBalances[acc.id] ?? 0, 'ARS', currency, usdArs),
                    currency
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
        <button className="btn-dashed" onClick={onConnectAccount}>
          + Conectar cuenta
        </button>
      </div>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {userEmail && (
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--text-faint)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {userEmail}
          </span>
        )}
        <button className="nav-item" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
