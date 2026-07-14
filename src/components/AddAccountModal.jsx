import { useState } from 'react';
import { ACCOUNT_TYPES } from '../data/initialData.js';
import { POPULAR_WALLETS, getWalletLogoUrl } from '../data/logos.js';

export default function AddAccountModal({ onClose, onCreate }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState('broker');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('ARS');

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), type, currency });
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Agregar cuenta</div>
            <div className="modal-step">
              Paso {step} de 2 · {step === 1 ? 'Elegí el tipo de cuenta' : 'Completá los datos'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {step === 1 && (
          <>
            <div className="type-grid">
              {Object.entries(ACCOUNT_TYPES).map(([key, info]) => (
                <button
                  key={key}
                  className={'type-card' + (type === key ? ' selected' : '')}
                  onClick={() => setType(key)}
                >
                  <div className="type-card-head">
                    <span className="type-card-title">{info.label}</span>
                    {type === key && <span className="type-check">✓</span>}
                  </div>
                  <div className="type-card-desc">{info.description}</div>
                </button>
              ))}
            </div>
            <div className="form-footer">
              <div className="divider" />
              <div className="modal-actions">
                <button className="btn-secondary" onClick={onClose}>
                  Cancelar
                </button>
                <button className="btn-submit" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => setStep(2)}>
                  Continuar →
                </button>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="form-footer" style={{ paddingTop: 24 }}>
            {type === 'billetera' && (
              <div className="field">
                <span className="field-label">Billeteras populares</span>
                <div className="wallet-chips">
                  {POPULAR_WALLETS.map((w) => (
                    <button
                      type="button"
                      key={w.name}
                      className={'wallet-chip' + (name === w.name ? ' selected' : '')}
                      onClick={() => setName(w.name)}
                    >
                      <img src={getWalletLogoUrl(w.name)} alt="" />
                      {w.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="field-grid">
              <label className="field">
                <span className="field-label">Nombre de la cuenta</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </label>
              <label className="field">
                <span className="field-label">Moneda principal</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="ARS">Pesos (ARS)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </label>
            </div>
            <div className="divider" />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setStep(1)}>
                ← Atrás
              </button>
              <button
                className="btn-submit"
                style={{ width: 'auto', padding: '10px 18px' }}
                onClick={submit}
                disabled={!name.trim()}
              >
                Crear cuenta
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
