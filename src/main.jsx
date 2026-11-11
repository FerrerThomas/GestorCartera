import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import LoginPage from './components/LoginPage.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import './index.css';
import './App.css';
import './styles/glass.css';

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-shell">
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>Cargando…</span>
      </div>
    );
  }
  return user ? <App /> : <LoginPage />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  </React.StrictMode>
);

// PWA: solo en producción (en dev el SW cachearía los módulos de Vite).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
