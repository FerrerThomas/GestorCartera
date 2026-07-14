import { useEffect, useMemo, useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import KpiCards from './components/KpiCards.jsx';
import AssetsTable from './components/AssetsTable.jsx';
import AddAccountModal from './components/AddAccountModal.jsx';
import AddAssetPanel from './components/AddAssetPanel.jsx';
import AssetDetailModal from './components/AssetDetailModal.jsx';
import AuditLogModal from './components/AuditLogModal.jsx';
import PortfolioChart from './components/PortfolioChart.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { usePortfolio } from './hooks/usePortfolio.js';
import { useMarketData } from './hooks/useMarketData.js';
import { usePortfolioHistory } from './hooks/usePortfolioHistory.js';
import { assetValueARS, assetInvestedARS, assetGainPct, USD_ARS } from './utils/finance.js';

export default function App() {
  const { user, signOut } = useAuth();
  const { accounts, assets, loading, error, createAccount, deleteAccount, addAsset, deleteAsset } =
    usePortfolio(user);
  const { dolarBlue, prices } = useMarketData(assets);
  const [currency, setCurrency] = useState('ARS');
  const [hora, setHora] = useState('');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [addAssetAccountId, setAddAssetAccountId] = useState(null);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const tick = () =>
      setHora(
        new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const usdArs = dolarBlue ?? USD_ARS;

  // Layers live-fetched prices over the DB-sourced assets for display only —
  // usePortfolio's own `assets` stays the raw persisted shape.
  const displayAssets = useMemo(
    () =>
      assets.map((a) => {
        if (a.kind === 'fund') return a;
        if (a.category === 'Efectivo') return dolarBlue != null ? { ...a, currentPrice: dolarBlue } : a;
        const live = prices[a.ticker];
        return live != null ? { ...a, currentPrice: live } : a;
      }),
    [assets, prices, dolarBlue]
  );

  const totalARS = useMemo(
    () => displayAssets.reduce((sum, a) => sum + assetValueARS(a, usdArs), 0),
    [displayAssets, usdArs]
  );
  const investedARS = useMemo(
    () => displayAssets.reduce((sum, a) => sum + assetInvestedARS(a, usdArs), 0),
    [displayAssets, usdArs]
  );
  const liquidityARS = useMemo(
    () =>
      displayAssets.reduce(
        (sum, a) =>
          sum + (a.kind === 'fund' || a.category === 'Efectivo' ? assetValueARS(a, usdArs) : 0),
        0
      ),
    [displayAssets, usdArs]
  );

  const bestAsset = useMemo(() => {
    const priced = displayAssets.filter((a) => a.kind !== 'fund');
    if (!priced.length) return null;
    const best = priced.reduce((b, a) =>
      assetGainPct(a, usdArs) > assetGainPct(b, usdArs) ? a : b
    );
    return { ticker: best.ticker, pct: assetGainPct(best, usdArs) };
  }, [displayAssets, usdArs]);

  const accountBalances = useMemo(() => {
    const map = {};
    for (const acc of accounts) map[acc.id] = 0;
    for (const a of displayAssets) {
      map[a.accountId] = (map[a.accountId] ?? 0) + assetValueARS(a, usdArs);
    }
    return map;
  }, [accounts, displayAssets, usdArs]);

  const conv = (v) => (currency === 'USD' ? v / usdArs : v);

  const portfolioHistory = usePortfolioHistory(user, totalARS, totalARS / usdArs, !loading);

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
      setAddAssetAccountId(null);
    } catch (e) {
      setActionError(e.message);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    try {
      setActionError('');
      await deleteAccount(accountId);
    } catch (e) {
      setActionError(e.message);
    }
  };

  const handleDeleteAsset = async (assetId) => {
    try {
      setActionError('');
      await deleteAsset(assetId);
      setSelectedAssetId(null);
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
        assets={assets}
        accountBalances={accountBalances}
        currency={currency}
        usdArs={usdArs}
        onConnectAccount={() => setShowAddAccount(true)}
        onAddAssetToAccount={(accountId) => {
          setAddAssetAccountId(accountId);
          setShowAddAsset(true);
        }}
        onDeleteAccount={handleDeleteAccount}
        onOpenAuditLog={() => setShowAuditLog(true)}
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
          dolarBlue={dolarBlue}
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
          assets={displayAssets}
          accounts={accounts}
          currency={currency}
          usdArs={usdArs}
          onAddAsset={() => setShowAddAsset(true)}
          onSelectAsset={(asset) => setSelectedAssetId(asset.id)}
        />
        <PortfolioChart history={portfolioHistory} currency={currency} />
      </main>

      {showAddAccount && (
        <AddAccountModal onClose={() => setShowAddAccount(false)} onCreate={handleCreateAccount} />
      )}
      {selectedAssetId &&
        (() => {
          const selected = displayAssets.find((a) => a.id === selectedAssetId);
          return selected ? (
            <AssetDetailModal
              asset={selected}
              accounts={accounts}
              currency={currency}
              usdArs={usdArs}
              onClose={() => setSelectedAssetId(null)}
              onDelete={handleDeleteAsset}
            />
          ) : null;
        })()}
      {showAuditLog && <AuditLogModal onClose={() => setShowAuditLog(false)} />}
      {showAddAsset && (
        <AddAssetPanel
          assets={displayAssets}
          accounts={accounts}
          initialAccountId={addAssetAccountId}
          onClose={() => {
            setShowAddAsset(false);
            setAddAssetAccountId(null);
          }}
          onSubmit={handleAddAssetSubmit}
        />
      )}
    </div>
  );
}
