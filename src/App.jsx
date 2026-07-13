import { useEffect, useMemo, useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import KpiCards from './components/KpiCards.jsx';
import AssetsTable from './components/AssetsTable.jsx';
import AddAccountModal from './components/AddAccountModal.jsx';
import AddAssetPanel from './components/AddAssetPanel.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { usePortfolio } from './hooks/usePortfolio.js';
import { assetValueARS, assetInvestedARS, assetGainPct, USD_ARS } from './utils/finance.js';

const LIVE_MARKET_CATEGORIES = ['Acción', 'CEDEAR', 'Cripto'];

export default function App() {
  const { user, signOut } = useAuth();
  const { accounts, assets, setAssets, loading, error, createAccount, addAsset } =
    usePortfolio(user);
  const [currency, setCurrency] = useState('ARS');
  const [hora, setHora] = useState('');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const tick = () => {
      setHora(
        new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setAssets((prev) =>
        prev.map((a) =>
          LIVE_MARKET_CATEGORIES.includes(a.category)
            ? { ...a, currentPrice: Math.max(0, a.currentPrice * (1 + (Math.random() - 0.48) * 0.0015)) }
            : a
        )
      );
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [setAssets]);

  const totalARS = useMemo(() => assets.reduce((sum, a) => sum + assetValueARS(a), 0), [assets]);
  const investedARS = useMemo(
    () => assets.reduce((sum, a) => sum + assetInvestedARS(a), 0),
    [assets]
  );
  const liquidityARS = useMemo(
    () =>
      assets.reduce(
        (sum, a) => sum + (a.kind === 'fund' || a.category === 'Efectivo' ? assetValueARS(a) : 0),
        0
      ),
    [assets]
  );

  const bestAsset = useMemo(() => {
    const priced = assets.filter((a) => a.kind !== 'fund');
    if (!priced.length) return null;
    const best = priced.reduce((b, a) => (assetGainPct(a) > assetGainPct(b) ? a : b));
    return { ticker: best.ticker, pct: assetGainPct(best) };
  }, [assets]);

  const accountBalances = useMemo(() => {
    const map = {};
    for (const acc of accounts) map[acc.id] = 0;
    for (const a of assets) {
      map[a.accountId] = (map[a.accountId] ?? 0) + assetValueARS(a);
    }
    return map;
  }, [accounts, assets]);

  const conv = (v) => (currency === 'USD' ? v / USD_ARS : v);

  const handleCreateAccount = async (data) => {
    try {
      setActionError('');
      await createAccount(data);
      setShowAddAccount(false);
    } catch (e) {
      setActionError(e.message);
    }
  };

  const handleAddAssetSubmit = async (payload) => {
    try {
      setActionError('');
      await addAsset(payload);
      setShowAddAsset(false);
    } catch (e) {
      setActionError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="auth-shell">
        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Cargando tu portfolio…</span>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        accounts={accounts}
        accountBalances={accountBalances}
        onConnectAccount={() => setShowAddAccount(true)}
        onSignOut={signOut}
        userEmail={user.email}
      />
      <main className="main">
        <TopBar
          total={conv(totalARS)}
          invested={conv(investedARS)}
          hora={hora || '—:—:—'}
          currency={currency}
          onSetCurrency={setCurrency}
        />
        <KpiCards
          invested={conv(investedARS)}
          bestAsset={bestAsset}
          liquidity={conv(liquidityARS)}
          currency={currency}
        />
        {(error || actionError) && (
          <div style={{ color: 'var(--negative)', fontSize: 12.5 }}>{error || actionError}</div>
        )}
        <AssetsTable
          assets={assets}
          accounts={accounts}
          currency={currency}
          onAddAsset={() => setShowAddAsset(true)}
        />
      </main>

      {showAddAccount && (
        <AddAccountModal onClose={() => setShowAddAccount(false)} onCreate={handleCreateAccount} />
      )}
      {showAddAsset && (
        <AddAssetPanel
          assets={assets}
          accounts={accounts}
          onClose={() => setShowAddAsset(false)}
          onSubmit={handleAddAssetSubmit}
        />
      )}
    </div>
  );
}
