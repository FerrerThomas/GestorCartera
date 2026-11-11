import { useCallback, useEffect, useMemo, useState } from 'react';
import AddAccountModal from './components/AddAccountModal.jsx';
import AuditLogModal from './components/AuditLogModal.jsx';
import AddAssetSheet from './components/glass/AddAssetSheet.jsx';
import AssetDetailSheet from './components/glass/AssetDetailSheet.jsx';
import MovementSheet from './components/glass/MovementSheet.jsx';
import TradeSheet from './components/glass/TradeSheet.jsx';
import { ActionSheet, TabBar, Toast } from './components/glass/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useMarketData } from './hooks/useMarketData.js';
import {
  currentMonthKey,
  movementActions,
  summarizeMonth,
  useCategories,
  useMonthMovements,
} from './hooks/useMovements.js';
import { usePortfolio } from './hooks/usePortfolio.js';
import { usePortfolioHistory } from './hooks/usePortfolioHistory.js';
import AjustesScreen from './screens/AjustesScreen.jsx';
import CarteraScreen from './screens/CarteraScreen.jsx';
import MovimientosScreen, { describeMovement } from './screens/MovimientosScreen.jsx';
import PresupuestosScreen from './screens/PresupuestosScreen.jsx';
import ResumenScreen from './screens/ResumenScreen.jsx';
import { USD_ARS, assetValueARS, formatAmount } from './utils/finance.js';

const SCREENS = ['resumen', 'movimientos', 'presupuesto', 'cartera', 'ajustes'];
const ACTION_TYPES = { gasto: 'expense', ingreso: 'income', transferencia: 'transfer' };

function screenFromHash() {
  const id = window.location.hash.replace(/^#\/?/, '');
  return SCREENS.includes(id) ? id : 'resumen';
}

function readCurrency() {
  try {
    return localStorage.getItem('currency') === 'USD' ? 'USD' : 'ARS';
  } catch {
    return 'ARS';
  }
}

export default function App() {
  const { user, signOut } = useAuth();
  const { accounts, assets, reload, loading, error, createAccount, deleteAccount, addAsset, deleteAsset } =
    usePortfolio(user);
  const { dolarBlue, prices } = useMarketData(assets);
  const [screen, setScreen] = useState(screenFromHash);
  const [currency, setCurrencyState] = useState(readCurrency);
  const [version, setVersion] = useState(0);
  const [sheetType, setSheetType] = useState(null);
  const [toast, setToast] = useState('');
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [movMonth, setMovMonth] = useState(currentMonthKey());
  const [accountFilter, setAccountFilter] = useState(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [addAssetAccountId, setAddAssetAccountId] = useState(null);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [tradeMode, setTradeMode] = useState(null);

  const usdArs = dolarBlue ?? USD_ARS;
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const clearToast = useCallback(() => setToast(''), []);

  useEffect(() => {
    if (error) setToast(error);
  }, [error]);

  const setCurrency = (c) => {
    setCurrencyState(c);
    try {
      localStorage.setItem('currency', c);
    } catch {
      // sin storage: queda solo en memoria
    }
  };

  // Navegación por hash (#/cartera) para que funcione el "atrás" del sistema.
  useEffect(() => {
    const onHash = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const goto = useCallback((id, opts) => {
    if (opts?.accountId !== undefined) setAccountFilter(opts.accountId);
    window.location.hash = `#/${id}`;
    setScreen(id);
    window.scrollTo({ top: 0 });
  }, []);

  // Accesos directos del manifest / Atajos: ?accion=gasto|ingreso|transferencia
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = ACTION_TYPES[params.get('accion')];
    if (t) {
      setSheetType(t);
      params.delete('accion');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    }
  }, []);

  // Barra de estado / pestaña de Safari del color del encabezado de cada pantalla.
  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue(`--hero-${screen}`).trim();
    if (!color) return;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
  }, [screen]);

  const { categories, missing: missingCategories } = useCategories(user, version);
  const current = useMonthMovements(user, currentMonthKey(), version);
  const browsing = useMonthMovements(user, movMonth, version);
  const missingMigration = missingCategories || current.missing;

  const monthSummary = useMemo(() => summarizeMonth(current.movements, usdArs), [current.movements, usdArs]);
  const browsingSummary = useMemo(() => summarizeMonth(browsing.movements, usdArs), [browsing.movements, usdArs]);

  // Precios en vivo sobre lo persistido (solo para mostrar).
  const displayAssets = useMemo(
    () =>
      assets.map((a) => {
        if (a.kind === 'fund') return a;
        if (a.category === 'Efectivo')
          return a.ticker === 'USD' && dolarBlue != null ? { ...a, currentPrice: dolarBlue } : a;
        const live = prices[a.ticker];
        return live != null ? { ...a, currentPrice: live } : a;
      }),
    [assets, prices, dolarBlue]
  );
  const visibleAssets = useMemo(
    () => displayAssets.filter((a) => (a.kind === 'fund' ? a.value > 0.01 : (a.qty ?? 0) > 0)),
    [displayAssets]
  );
  const totalARS = useMemo(
    () => displayAssets.reduce((sum, a) => sum + assetValueARS(a, usdArs), 0),
    [displayAssets, usdArs]
  );
  const accountBalances = useMemo(() => {
    const map = {};
    for (const acc of accounts) map[acc.id] = 0;
    for (const a of displayAssets) map[a.accountId] = (map[a.accountId] ?? 0) + assetValueARS(a, usdArs);
    return map;
  }, [accounts, displayAssets, usdArs]);
  // Plata disponible para gastar por cuenta y moneda (billetera + efectivo).
  const cashByAccount = useMemo(() => {
    const map = {};
    for (const a of displayAssets) {
      const m = (map[a.accountId] ??= { ARS: 0, USD: 0 });
      if (a.kind === 'fund') m.ARS += a.value;
      else if (a.category === 'Efectivo' && (a.ticker === 'ARS' || a.ticker === 'USD')) m[a.ticker] += a.qty ?? 0;
    }
    return map;
  }, [displayAssets]);

  const portfolioHistory = usePortfolioHistory(user, totalARS, totalARS / usdArs, !loading);

  const run = async (fn, okMsg) => {
    try {
      await fn();
      if (okMsg) setToast(okMsg);
      return true;
    } catch (e) {
      setToast(e.message);
      return false;
    }
  };

  const openNew = (type) => {
    if (!accounts.length) {
      setToast('Primero creá una cuenta en Ajustes.');
      return;
    }
    setSheetType(type);
  };

  if (loading) {
    return (
      <div className="auth-shell">
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>Cargando tu patrimonio…</span>
      </div>
    );
  }

  const selectedAsset = selectedAssetId ? displayAssets.find((a) => a.id === selectedAssetId) : null;

  return (
    <div className="shell">
      {screen === 'resumen' && (
        <ResumenScreen
          userEmail={user.email}
          currency={currency}
          onSetCurrency={setCurrency}
          totalARS={totalARS}
          usdArs={usdArs}
          history={portfolioHistory}
          accounts={accounts}
          assets={visibleAssets}
          accountBalances={accountBalances}
          month={monthSummary}
          categories={categories}
          missingMigration={missingMigration}
          onNew={openNew}
          onOpenSettings={() => goto('ajustes')}
          onOpenHistory={() => setShowAuditLog(true)}
          onGoto={goto}
        />
      )}
      {screen === 'movimientos' && (
        <MovimientosScreen
          monthKey={movMonth}
          onChangeMonth={setMovMonth}
          movements={browsing.movements}
          summary={browsingSummary}
          categories={categories}
          accounts={accounts}
          loading={browsing.loading}
          missingMigration={browsing.missing}
          onNew={openNew}
          onSelectMovement={setSelectedMovement}
        />
      )}
      {screen === 'presupuesto' && (
        <PresupuestosScreen
          user={user}
          categories={categories}
          missingCategories={missingCategories}
          version={version}
          usdArs={usdArs}
          onChanged={bump}
          onToast={setToast}
        />
      )}
      {screen === 'cartera' && (
        <CarteraScreen
          assets={visibleAssets}
          accounts={accounts}
          currency={currency}
          usdArs={usdArs}
          history={portfolioHistory}
          totalARS={totalARS}
          accountFilter={accountFilter}
          onClearAccount={() => setAccountFilter(null)}
          onSelectAsset={(a) => setSelectedAssetId(a.id)}
          onAddAsset={() => {
            setAddAssetAccountId(accountFilter);
            setShowAddAsset(true);
          }}
        />
      )}
      {screen === 'ajustes' && (
        <AjustesScreen
          user={user}
          accounts={accounts}
          assets={visibleAssets}
          currency={currency}
          onSetCurrency={setCurrency}
          onAddAccount={() => setShowAddAccount(true)}
          onDeleteAccount={(id) => run(() => deleteAccount(id), 'Cuenta eliminada')}
          onOpenHistory={() => setShowAuditLog(true)}
          onSignOut={signOut}
          onBack={() => goto('resumen')}
          onToast={setToast}
        />
      )}

      <TabBar current={screen} onChange={goto} onNew={() => openNew('expense')} />

      <Toast message={toast} onDone={clearToast} />

      {sheetType && (
        <MovementSheet
          initialType={sheetType}
          accounts={accounts}
          categories={categories}
          cashByAccount={cashByAccount}
          usdArs={usdArs}
          spentByCategory={monthSummary.byCategory}
          onClose={() => setSheetType(null)}
          onSaved={(msg) => {
            setSheetType(null);
            setToast(`✓ ${msg}`);
            bump();
            reload();
          }}
        />
      )}

      {selectedMovement && (
        <ActionSheet
          message={(() => {
            const d = describeMovement(selectedMovement, categories, accounts);
            return `${d.title} · ${formatAmount(selectedMovement.amount, selectedMovement.currency)}\n${d.sub}`;
          })()}
          actions={[
            {
              label: 'Deshacer movimiento',
              danger: true,
              onSelect: () =>
                run(async () => {
                  await movementActions.remove(selectedMovement.id);
                  bump();
                  await reload();
                }, 'Movimiento deshecho'),
            },
          ]}
          onClose={() => setSelectedMovement(null)}
        />
      )}

      {showAddAccount && (
        <AddAccountModal
          onClose={() => setShowAddAccount(false)}
          onCreate={async (data) => {
            if (await run(() => createAccount(data), `Cuenta "${data.name}" creada`)) setShowAddAccount(false);
          }}
        />
      )}
      {selectedAsset && (
        <AssetDetailSheet
          asset={selectedAsset}
          account={accounts.find((a) => a.id === selectedAsset.accountId)}
          usdArs={usdArs}
          onClose={() => {
            setSelectedAssetId(null);
            setTradeMode(null);
          }}
          onTrade={setTradeMode}
          onDelete={async (id) => {
            if (await run(() => deleteAsset(id), 'Activo eliminado')) setSelectedAssetId(null);
          }}
        />
      )}
      {selectedAsset && tradeMode && (
        <TradeSheet
          asset={selectedAsset}
          account={accounts.find((a) => a.id === selectedAsset.accountId)}
          mode={tradeMode}
          onClose={() => setTradeMode(null)}
          onSubmit={(payload) =>
            run(() => addAsset(payload), payload.type === 'sell' || payload.type === 'fund_withdraw' ? 'Venta registrada' : 'Compra registrada')
          }
        />
      )}
      {showAuditLog && <AuditLogModal onClose={() => setShowAuditLog(false)} />}
      {showAddAsset && (
        <AddAssetSheet
          accounts={accounts}
          assets={displayAssets}
          initialAccountId={addAssetAccountId}
          usdArs={usdArs}
          onClose={() => {
            setShowAddAsset(false);
            setAddAssetAccountId(null);
          }}
          onSubmit={(payload) => run(() => addAsset(payload), payload.type === 'fund_topup' ? 'Depósito registrado' : 'Activo agregado')}
        />
      )}
    </div>
  );
}
