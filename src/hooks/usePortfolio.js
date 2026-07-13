import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { getAssetIcon } from '../utils/assetIcon.js';
import { calcAveragePrice, formatDateDDMMYYYY } from '../utils/finance.js';

function mapAsset(row) {
  const history = (row.asset_history ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.occurred_on) - new Date(b.occurred_on) ||
        new Date(a.created_at) - new Date(b.created_at)
    )
    .map((h) => ({
      date: formatDateDDMMYYYY(h.occurred_on),
      qty: Number(h.qty),
      price: Number(h.price),
    }));

  const icon = getAssetIcon(row.ticker);
  const base = {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    category: row.category,
    accountId: row.account_id,
    currency: row.currency,
    history,
    ...icon,
  };

  if (row.kind === 'fund') {
    return {
      ...base,
      kind: 'fund',
      value: Number(row.fund_value),
      gainAbs: Number(row.fund_gain_abs ?? 0),
      tna: Number(row.fund_tna ?? 0),
    };
  }

  const { newQty, newAvgPrice } = history.reduce(
    (acc, h) => calcAveragePrice(acc.newQty, acc.newAvgPrice, h.qty, h.price),
    { newQty: 0, newAvgPrice: 0, newInvested: 0 }
  );

  return {
    ...base,
    qty: newQty,
    avgPrice: newAvgPrice,
    currentPrice: Number(row.current_price),
  };
}

export function usePortfolio(user) {
  const [accounts, setAccounts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [accountsRes, assetsRes] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at'),
      supabase
        .from('assets')
        .select('*, asset_history(qty, price, occurred_on, created_at)')
        .order('created_at'),
    ]);
    setError(accountsRes.error?.message ?? assetsRes.error?.message ?? null);
    setAccounts(accountsRes.data ?? []);
    setAssets((assetsRes.data ?? []).map(mapAsset));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createAccount = useCallback(
    async (data) => {
      const { data: row, error: err } = await supabase
        .from('accounts')
        .insert({ user_id: user.id, name: data.name, type: data.type, currency: data.currency })
        .select()
        .single();
      if (err) throw err;
      setAccounts((prev) => [...prev, row]);
      return row;
    },
    [user]
  );

  const addAsset = useCallback(
    async (payload) => {
      if (payload.type === 'existing') {
        const { error: err } = await supabase.from('asset_history').insert({
          asset_id: payload.assetId,
          user_id: user.id,
          qty: payload.qty,
          price: payload.price,
        });
        if (err) throw err;
      } else {
        const { data: assetRow, error: assetErr } = await supabase
          .from('assets')
          .insert({
            user_id: user.id,
            account_id: payload.asset.accountId,
            ticker: payload.asset.ticker,
            name: payload.asset.name,
            category: payload.asset.category,
            currency: payload.asset.currency,
            kind: 'position',
            current_price: payload.price,
          })
          .select()
          .single();
        if (assetErr) throw assetErr;
        const { error: histErr } = await supabase.from('asset_history').insert({
          asset_id: assetRow.id,
          user_id: user.id,
          qty: payload.qty,
          price: payload.price,
        });
        if (histErr) throw histErr;
      }
      await reload();
    },
    [user, reload]
  );

  return { accounts, assets, setAssets, loading, error, createAccount, addAsset };
}
