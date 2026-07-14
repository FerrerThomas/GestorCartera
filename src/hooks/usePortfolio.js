import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { getAssetIcon } from '../utils/assetIcon.js';
import { calcAveragePrice, formatDateDDMMYYYY } from '../utils/finance.js';

// Calendar days elapsed since a date ("YYYY-MM-DD" or timestamptz), never negative.
function daysSince(dateInput) {
  let t = null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateInput ?? ''));
  if (m) t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (t == null) t = new Date(dateInput).getTime();
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((todayUTC - t) / 86400000));
}

// Daily-compounded interest accrued by a money-market style fund. Each deposit
// (history row: qty = amount, price = 1) accrues from its own date at the
// fund's current TNA. Funds created before deposits were recorded in history
// fall back to accruing the whole principal from the asset's created_at.
function fundAccruedGain(history, tna, principal, createdAt) {
  const dailyRate = tna / 100 / 365;
  if (dailyRate <= 0) return 0;
  if (history.length > 0) {
    return history.reduce(
      (sum, h) => sum + h.qty * (Math.pow(1 + dailyRate, daysSince(h.dateRaw)) - 1),
      0
    );
  }
  return principal * (Math.pow(1 + dailyRate, daysSince(createdAt)) - 1);
}

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
      dateRaw: h.occurred_on,
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
    const tna = Number(row.fund_tna ?? 0);
    const principal = Number(row.fund_value);
    const accrued = fundAccruedGain(history, tna, principal, row.created_at);
    return {
      ...base,
      kind: 'fund',
      value: principal + accrued,
      gainAbs: accrued,
      tna,
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
      if (payload.type === 'fund_topup') {
        let fundAssetId = payload.existingAssetId;
        if (fundAssetId) {
          // Read the current value fresh from the DB rather than relying on
          // possibly-stale client state, so consecutive top-ups always add correctly.
          const { data: current, error: readErr } = await supabase
            .from('assets')
            .select('fund_value')
            .eq('id', fundAssetId)
            .single();
          if (readErr) throw readErr;
          const { error: err } = await supabase
            .from('assets')
            .update({
              fund_value: Number(current?.fund_value ?? 0) + payload.amount,
              fund_tna: payload.tna,
            })
            .eq('id', fundAssetId);
          if (err) throw err;
        } else {
          const { data: fundRow, error: err } = await supabase
            .from('assets')
            .insert({
              user_id: user.id,
              account_id: payload.accountId,
              ticker: 'SALDO',
              name: 'Saldo',
              category: 'Fondo money market',
              currency: 'ARS',
              kind: 'fund',
              fund_value: payload.amount,
              fund_gain_abs: 0,
              fund_tna: payload.tna,
            })
            .select()
            .single();
          if (err) throw err;
          fundAssetId = fundRow.id;
        }
        // Record the deposit itself (qty = amount, price = 1) so the fund's
        // daily accrual and the movements view have real dates to work from.
        const { error: histErr } = await supabase.from('asset_history').insert({
          asset_id: fundAssetId,
          user_id: user.id,
          qty: payload.amount,
          price: 1,
        });
        if (histErr) throw histErr;
      } else if (payload.type === 'existing') {
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
