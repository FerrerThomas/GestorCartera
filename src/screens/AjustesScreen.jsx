import { useState } from 'react';
import Icon, { accountColor, accountTypeLabel } from '../components/glass/Icon.jsx';
import { ActionSheet, MigrationBanner, Segmented } from '../components/glass/ui.jsx';
import { useApiTokens } from '../hooks/useMovements.js';

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/quick-action`;

function timeAgo(iso) {
  if (!iso) return 'nunca usado';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'usado recién';
  if (mins < 60) return `usado hace ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `usado hace ${h} h`;
  const d = Math.round(h / 24);
  return `usado hace ${d} día${d === 1 ? '' : 's'}`;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AjustesScreen({
  user,
  accounts,
  assets,
  currency,
  onSetCurrency,
  onAddAccount,
  onDeleteAccount,
  onOpenHistory,
  onSignOut,
  onBack,
  onToast,
}) {
  const { tokens, missing, create, revoke } = useApiTokens(user, true);
  const [newToken, setNewToken] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const tok = await create('iPhone');
      setNewToken(tok);
    } catch (e) {
      onToast(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="screen">
      <section className="hero" style={{ '--hero': 'var(--hero-ajustes)', gap: 8, paddingBottom: 20 }}>
        <div>
          <button type="button" className="capsule-btn glass clear" onClick={onBack} style={{ paddingLeft: 10 }}>
            <Icon name="chevronLeft" size={20} stroke={2.4} /> Resumen
          </button>
        </div>
        <h1 className="large-title">Ajustes</h1>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{user.email}</span>
      </section>

      <div className="content two-col">
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-labelledby="h-atajos">
          <h2 id="h-atajos" className="section-caption">
            Atajos de iOS
          </h2>
          {missing ? (
            <MigrationBanner />
          ) : (
            <ul className="list">
              <li>
                <div className="row" style={{ alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                  <span className="dot-icon sm" style={{ background: '#5E5CE6', borderRadius: 8 }} aria-hidden="true">
                    <Icon name="bolt" size={17} stroke={2.2} />
                  </span>
                  <p style={{ margin: 0, paddingRight: 16, fontSize: 15, lineHeight: 1.4, color: 'var(--label-2)' }}>
                    Cargá gastos desde el widget de Atajos, el botón de Acción o Siri sin abrir la app. En Atajos usá{' '}
                    <strong>Obtener contenido de URL</strong> con esta dirección y el token como encabezado{' '}
                    <code>Authorization: Bearer …</code>
                  </p>
                </div>
              </li>
              <li>
                <div className="token-box" style={{ background: 'transparent' }}>
                  <code title={ENDPOINT}>{ENDPOINT}</code>
                  <button
                    type="button"
                    className="capsule-btn plain"
                    style={{ minHeight: 38 }}
                    onClick={async () => onToast((await copy(ENDPOINT)) ? 'Dirección copiada' : 'No se pudo copiar')}
                  >
                    Copiar
                  </button>
                </div>
              </li>
              {newToken && (
                <li>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ padding: '10px 16px 0', fontSize: 13, fontWeight: 600, color: '#5E5CE6' }}>
                      Copialo ahora: no se vuelve a mostrar
                    </span>
                    <div className="token-box">
                      <code>{newToken}</code>
                      <button
                        type="button"
                        className="capsule-btn glass tint"
                        style={{ minHeight: 38 }}
                        onClick={async () => onToast((await copy(newToken)) ? 'Token copiado' : 'No se pudo copiar')}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </li>
              )}
              <li>
                <button type="button" className="row" onClick={generate} disabled={busy} style={{ minHeight: 48 }}>
                  <span className="row-body">
                    <span className="row-action">{busy ? 'Generando…' : 'Generar token nuevo'}</span>
                  </span>
                </button>
              </li>
              {tokens.map((t) => (
                <li key={t.id}>
                  <div className="row">
                    <span className="row-body">
                      <span className="row-main">
                        <span className="row-title">{t.name}</span>
                        <span className="row-sub">
                          …{t.token_hint} · {timeAgo(t.last_used_at)}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="capsule-btn"
                        style={{ border: 0, background: 'transparent', color: 'var(--red)', font: 'inherit', fontSize: 17 }}
                        onClick={() =>
                          setConfirm({
                            message: `Los Atajos que usan el token …${t.token_hint} van a dejar de funcionar.`,
                            label: 'Revocar token',
                            run: () => revoke(t.id).catch((e) => onToast(e.message)),
                          })
                        }
                      >
                        Revocar
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-labelledby="h-cuentas-aj">
          <h2 id="h-cuentas-aj" className="section-caption">
            Cuentas
          </h2>
          <ul className="list">
            {accounts.map((acc) => {
              const n = assets.filter((a) => a.accountId === acc.id).length;
              return (
                <li key={acc.id}>
                  <div className="row">
                    <span className="dot-icon sm" aria-hidden="true" style={{ background: accountColor(acc) }}>
                      {acc.name[0]?.toUpperCase()}
                    </span>
                    <span className="row-body">
                      <span className="row-main">
                        <span className="row-title">{acc.name}</span>
                        <span className="row-sub">
                          {accountTypeLabel(acc)} · {acc.currency} · {n} activo{n === 1 ? '' : 's'}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ color: 'var(--red)' }}
                        aria-label={`Eliminar ${acc.name}`}
                        onClick={() =>
                          setConfirm({
                            message: `Se elimina "${acc.name}" con ${n} activo${n === 1 ? '' : 's'} y su historial. No se puede deshacer.`,
                            label: 'Eliminar cuenta',
                            run: () => onDeleteAccount(acc.id),
                          })
                        }
                      >
                        <Icon name="trash" size={19} />
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
            <li>
              <button type="button" className="row" onClick={onAddAccount} style={{ minHeight: 48 }}>
                <span className="row-body">
                  <span className="row-action">Agregar cuenta</span>
                </span>
              </button>
            </li>
          </ul>

          <h2 className="section-caption" style={{ marginTop: 10 }}>
            General
          </h2>
          <ul className="list">
            <li>
              <div className="row">
                <span className="row-body">
                  <span className="row-main">
                    <span className="row-title">Moneda principal</span>
                  </span>
                  <Segmented
                    label="Moneda principal"
                    className="small"
                    glass=""
                    value={currency}
                    onChange={onSetCurrency}
                    options={[
                      { value: 'ARS', label: 'ARS' },
                      { value: 'USD', label: 'USD' },
                    ]}
                  />
                </span>
              </div>
            </li>
            <li>
              <button type="button" className="row" onClick={onOpenHistory}>
                <span className="row-body">
                  <span className="row-main">
                    <span className="row-title">Historial de cambios</span>
                  </span>
                  <Icon name="chevronRight" size={16} stroke={2.6} color="var(--label-3)" />
                </span>
              </button>
            </li>
          </ul>

          <ul className="list" style={{ marginTop: 10 }}>
            <li>
              <button type="button" className="row" onClick={onSignOut} style={{ minHeight: 48, justifyContent: 'center', paddingLeft: 0 }}>
                <span className="row-action danger">Cerrar sesión</span>
              </button>
            </li>
          </ul>
        </section>
      </div>

      {confirm && (
        <ActionSheet
          message={confirm.message}
          actions={[{ label: confirm.label, danger: true, onSelect: confirm.run }]}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
