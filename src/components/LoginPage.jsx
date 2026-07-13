import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { signInWithPassword, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    const { error: err } =
      mode === 'signin'
        ? await signInWithPassword(email, password)
        : await signUp(email, password);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (mode === 'signup') {
      setInfo('Cuenta creada. Revisá tu email para confirmar antes de iniciar sesión.');
    }
  };

  const handleGoogle = async () => {
    setError('');
    const { error: err } = await signInWithGoogle();
    if (err) setError(err.message);
  };

  return (
    <div className="auth-shell">
      <div className="modal-card" style={{ width: 400 }}>
        <div className="modal-head" style={{ justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
          <div className="brand" style={{ marginBottom: 4 }}>
            <div className="brand-mark">P</div>
            <div className="brand-name">Mi Portfolio</div>
          </div>
          <div className="modal-step">
            {mode === 'signin' ? 'Iniciá sesión para continuar' : 'Creá tu cuenta'}
          </div>
        </div>

        <form className="form-footer" style={{ paddingTop: 24 }} onSubmit={submit}>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>

          {error && <div style={{ color: 'var(--negative)', fontSize: 12.5 }}>{error}</div>}
          {info && <div style={{ color: 'var(--positive)', fontSize: 12.5 }}>{info}</div>}

          <button className="btn-submit" type="submit" disabled={busy}>
            {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>

          <div className="divider" />

          <button type="button" className="btn-google" onClick={handleGoogle}>
            <GoogleIcon /> Continuar con Google
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
              setInfo('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: 12.5,
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            {mode === 'signin' ? '¿No tenés cuenta? Creá una' : '¿Ya tenés cuenta? Iniciá sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
