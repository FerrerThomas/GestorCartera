import { useEffect, useMemo, useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import KpiCards from './components/KpiCards.jsx';
import AssetsTable from './components/AssetsTable.jsx';
import AddAccountModal from './components/AddAccountModal.jsx';
import AddAssetPanel from './components/AddAssetPanel.jsx';
import { initialAccounts, initialAssets } from './data/initialData.js';
import {
  assetValueARS,
  assetInvestedARS,
  assetGainPct,
  calcAveragePrice,
  todayDDMMYYYY,
  USD_ARS,
} from './utils/finance.js';

const LIVE_MARKET_CATEGORIES = ['Acción', 'CEDEAR', 'Cripto'];

export default function App() {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [assets, setAssets] = useState(initialAssets);
  const [currency, setCurrency] = useState('ARS');
  const [hora, setHora] = useState('');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);

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
  }, []);

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

  const handleCreateAccount = (data) => {
    const id = data.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
    setAccounts((prev) => [...prev, { id, ...data }]);
    setShowAddAccount(false);
  };

  const handleAddAssetSubmit = (payload) => {
    const dateStr = todayDDMMYYYY();
    if (payload.type === 'existing') {
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== payload.assetId) return a;
          const { newQty, newAvgPrice } = calcAveragePrice(a.qty, a.avgPrice, payload.qty, payload.price);
          return {
            ...a,
            qty: newQty,
            avgPrice: newAvgPrice,
            history: [...a.history, { date: dateStr, qty: payload.qty, price: payload.price }],
          };
        })
      );
    } else {
      const id = payload.asset.ticker.toLowerCase() + '-' + Date.now().toString(36);
      setAssets((prev) => [
        ...prev,
        {
          id,
          ticker: payload.asset.ticker,
          name: payload.asset.name,
          category: payload.asset.category,
          accountId: payload.asset.accountId,
          currency: payload.asset.currency,
          qty: payload.qty,
          avgPrice: payload.price,
          currentPrice: payload.price,
          iconBg: 'rgba(255,255,255,.1)',
          iconColor: '#e8eaee',
          iconLabel: payload.asset.ticker.slice(0, 2).toUpperCase(),
          history: [{ date: dateStr, qty: payload.qty, price: payload.price }],
        },
      ]);
    }
    setShowAddAsset(false);
  };

  return (
    <div className="app">
      <Sidebar
        accounts={accounts}
        accountBalances={accountBalances}
        onConnectAccount={() => setShowAddAccount(true)}
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
