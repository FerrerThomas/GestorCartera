import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import LoginPage from './components/LoginPage.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import './index.css';
import './App.css';

function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-shell">
        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Cargando…</span>
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
