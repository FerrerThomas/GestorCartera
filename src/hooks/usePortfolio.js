import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { getAssetIcon } from '../utils/assetIcon.js';
import { calcAveragePrice, formatDateDDMMYYYY, formatMoney } from '../utils/finance.js';

// Best-effort audit trail insert — a logging failure must never block the
// action it's describing. No FK to accounts/assets on purpose: the trail
// has to survive deleting the thing it refers to.
async function logEvent(userId, action, description) {
  try {
    await supabase.from('audit_log').insert({ user_id: userId, action, description });
  } catch {
    // ignore
  }
}

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
    imageUrl: row.image_url ?? null,
    history,
    ...icon,
  };

  if (row.kind === 'fund' && row.fund_units != null && Number(row.fund_vcp) > 0) {
    // Billetera vinculada a un FCI: vale cuotapartes × valor de la cuotaparte.
    const principal = Number(row.fund_value);
    const units = Number(row.fund_units);
    const vcp = Number(row.fund_vcp);
    const value = units * vcp;
    return {
      ...base,
      kind: 'fund',
      value,
      gainAbs: value - principal,
      principal,
      tna: Number(row.fund_tna ?? 0),
      units,
      vcp,
      vcpDate: row.fund_vcp_date ?? null,
    };
  }

  if (row.kind === 'fund') {
    const tna = Number(row.fund_tna ?? 0);
    const principal = Number(row.fund_value);
    const accrued = fundAccruedGain(history, tna, principal, row.created_at);
    return {
      ...base,
      kind: 'fund',
      value: principal + accrued,
      gainAbs: accrued,
      principal,
      units: null,
      tna,
    };
  }

  // Compras recalculan el PPC; las ventas (qty negativa) solo restan cantidad —
  // vender no cambia el precio promedio de lo que queda (estándar contable).
  const { newQty, newAvgPrice } = history.reduce(
    (acc, h) => {
      if (h.qty > 0) return calcAveragePrice(acc.newQty, acc.newAvgPrice, h.qty, h.price);
      return { ...acc, newQty: Math.max(0, acc.newQty + h.qty) };
    },
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
        .insert({
          user_id: user.id,
          name: data.name,
          type: data.type,
          currency: data.currency,
          ...(data.fundFci ? { fund_fci: data.fundFci } : {}),
          ...(data.fundApi ? { fund_api: data.fundApi } : {}),
        })
        .select()
        .single();
      if (err) throw err;
      setAccounts((prev) => [...prev, row]);
      logEvent(user.id, 'account_created', `Cuenta creada: ${data.name}`);
      return row;
    },
    [user]
  );

  const deleteAccount = useCallback(
    async (accountId) => {
      const account = accounts.find((a) => a.id === accountId);
      const assetCount = assets.filter((a) => a.accountId === accountId).length;
      const { error: err } = await supabase.from('accounts').delete().eq('id', accountId);
      if (err) throw err;
      await reload();
      logEvent(
        user.id,
        'account_deleted',
        `Cuenta eliminada: ${account?.name ?? accountId} (${assetCount} activo${assetCount === 1 ? '' : 's'})`
      );
    },
    [user, accounts, assets, reload]
  );

  const deleteAsset = useCallback(
    async (assetId) => {
      const asset = assets.find((a) => a.id === assetId);
      const { error: err } = await supabase.from('assets').delete().eq('id', assetId);
      if (err) throw err;
      await reload();
      logEvent(user.id, 'asset_deleted', `Activo eliminado: ${asset?.ticker ?? assetId}`);
    },
    [user, assets, reload]
  );

  const addAsset = useCallback(
    async (payload) => {
      const accountName = (id) => accounts.find((a) => a.id === id)?.name ?? id;

      if (payload.type === 'fund_topup') {
        const isNewFund = !payload.existingAssetId;
        let fundAssetId = payload.existingAssetId;
        if (fundAssetId) {
          // Read the current value fresh from the DB rather than relying on
          // possibly-stale client state, so consecutive top-ups always add correctly.
          const { data: current, error: readErr } = await supabase
            .from('assets')
            .select('fund_value, fund_units, fund_vcp')
            .eq('id', fundAssetId)
            .single();
          if (readErr) throw readErr;
          const update = { fund_value: Number(current?.fund_value ?? 0) + payload.amount };
          if (current?.fund_units != null) {
            // Por cuotapartes: compra cuotapartes al valor del día.
            const vcp = payload.vcp ?? Number(current.fund_vcp);
            if (!(vcp > 0)) throw new Error('No hay valor de cuotaparte para registrar el depósito.');
            update.fund_units = Number(current.fund_units) + payload.amount / vcp;
            if (payload.vcp) {
              update.fund_vcp = payload.vcp;
              update.fund_vcp_date = payload.vcpDate ?? null;
            }
            if (payload.tna != null) update.fund_tna = payload.tna;
          } else {
            update.fund_tna = payload.tna;
          }
          const { error: err } = await supabase.from('assets').update(update).eq('id', fundAssetId);
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
              fund_tna: payload.tna ?? 0,
              ...(payload.vcp
                ? {
                    fund_units: payload.amount / payload.vcp,
                    fund_vcp: payload.vcp,
                    fund_vcp_date: payload.vcpDate ?? null,
                  }
                : {}),
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
          ...(payload.occurredOn ? { occurred_on: payload.occurredOn } : {}),
        });
        if (histErr) throw histErr;
        logEvent(
          user.id,
          isNewFund ? 'fund_created' : 'fund_deposit',
          `${isNewFund ? 'Billetera activada' : 'Depósito'} en ${accountName(payload.accountId)}: ${formatMoney(payload.amount, 'ARS')}`
        );
      } else if (payload.type === 'fund_withdraw') {
        // Retiro de billetera: baja el principal y deja la fila negativa en el
        // ledger (misma lectura fresca anti-stale que el depósito).
        const { data: current, error: readErr } = await supabase
          .from('assets')
          .select('fund_value, fund_units, fund_vcp')
          .eq('id', payload.assetId)
          .single();
        if (readErr) throw readErr;
        const update = { fund_value: Number(current?.fund_value ?? 0) - payload.amount };
        if (current?.fund_units != null) {
          // Rescate: vende cuotapartes al valor del día.
          const vcp = payload.vcp ?? Number(current.fund_vcp);
          if (!(vcp > 0)) throw new Error('No hay valor de cuotaparte para registrar el retiro.');
          update.fund_units = Math.max(0, Number(current.fund_units) - payload.amount / vcp);
          if (payload.vcp) {
            update.fund_vcp = payload.vcp;
            update.fund_vcp_date = payload.vcpDate ?? null;
          }
        }
        const { error: err } = await supabase.from('assets').update(update).eq('id', payload.assetId);
        if (err) throw err;
        const { error: histErr } = await supabase.from('asset_history').insert({
          asset_id: payload.assetId,
          user_id: user.id,
          qty: -payload.amount,
          price: 1,
          ...(payload.occurredOn ? { occurred_on: payload.occurredOn } : {}),
        });
        if (histErr) throw histErr;
        logEvent(
          user.id,
          'fund_withdrawal',
          `Retiro de ${accountName(payload.accountId)}: ${formatMoney(payload.amount, 'ARS')}`
        );
      } else if (payload.type === 'sell') {
        const asset = assets.find((a) => a.id === payload.assetId);
        const { error: err } = await supabase.from('asset_history').insert({
          asset_id: payload.assetId,
          user_id: user.id,
          qty: -payload.qty,
          price: payload.price,
          ...(payload.occurredOn ? { occurred_on: payload.occurredOn } : {}),
        });
        if (err) throw err;
        const cur = asset?.currency === 'USD' ? 'USD' : 'ARS';
        const realized = payload.qty * (payload.price - (asset?.avgPrice ?? payload.price));
        logEvent(
          user.id,
          'asset_sold',
          `Venta: ${payload.qty} ${asset?.ticker ?? payload.assetId} a ${formatMoney(payload.price, cur)} — resultado ${(realized >= 0 ? '+' : '−') + formatMoney(Math.abs(realized), cur)}`
        );
      } else if (payload.type === 'existing') {
        const { error: err } = await supabase.from('asset_history').insert({
          asset_id: payload.assetId,
          user_id: user.id,
          qty: payload.qty,
          price: payload.price,
          ...(payload.occurredOn ? { occurred_on: payload.occurredOn } : {}),
        });
        if (err) throw err;
        const existingAsset = assets.find((a) => a.id === payload.assetId);
        logEvent(
          user.id,
          'asset_bought',
          `Compra: ${payload.qty} ${existingAsset?.ticker ?? payload.assetId} a ${formatMoney(payload.price, existingAsset?.currency === 'USD' ? 'USD' : 'ARS')}`
        );
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
            image_url: payload.asset.imageUrl ?? null,
          })
          .select()
          .single();
        if (assetErr) throw assetErr;
        const { error: histErr } = await supabase.from('asset_history').insert({
          asset_id: assetRow.id,
          user_id: user.id,
          qty: payload.qty,
          price: payload.price,
          ...(payload.occurredOn ? { occurred_on: payload.occurredOn } : {}),
        });
        if (histErr) throw histErr;
        logEvent(
          user.id,
          'asset_created',
          `Activo agregado: ${payload.asset.ticker} en ${accountName(payload.asset.accountId)} — ${payload.qty} a ${formatMoney(payload.price, payload.asset.currency === 'USD' ? 'USD' : 'ARS')}`
        );
      }
      await reload();
    },
    [user, accounts, assets, reload]
  );

  // Vincula una billetera a un FCI (cuotapartes), a una tasa publicada o a
  // TNA manual. Al pasar a cuotapartes se convierte el saldo actual al valor
  // de la cuotaparte de hoy, así el saldo y la ganancia no saltan.
  const setAccountYield = useCallback(
    async (accountId, { fci = null, api = null, vcp = null, vcpDate = null, tna = null, currentValue = null }) => {
      const { error: accErr } = await supabase
        .from('accounts')
        .update({ fund_fci: fci, fund_api: api })
        .eq('id', accountId);
      if (accErr) throw accErr;
      const fund = assets.find((a) => a.accountId === accountId && a.kind === 'fund');
      if (fund) {
        let update;
        if (fci) {
          if (!(vcp > 0)) throw new Error('No se pudo obtener el valor de la cuotaparte de ese fondo.');
          update = {
            fund_units: (currentValue ?? fund.value) / vcp,
            fund_vcp: vcp,
            fund_vcp_date: vcpDate,
            ...(tna != null ? { fund_tna: tna } : {}),
          };
        } else {
          update = { fund_units: null, fund_vcp: null, fund_vcp_date: null, ...(tna != null ? { fund_tna: tna } : {}) };
        }
        const { error } = await supabase.from('assets').update(update).eq('id', fund.id);
        if (error) throw error;
      }
      const name = accounts.find((a) => a.id === accountId)?.name ?? accountId;
      logEvent(user.id, 'account_yield', `Rendimiento de ${name}: ${fci ?? (api ? `tasa ${api}` : 'TNA manual')}`);
      await reload();
    },
    [user, accounts, assets, reload]
  );

  return {
    accounts,
    assets,
    setAccountYield,
    setAssets,
    reload,
    loading,
    error,
    createAccount,
    deleteAccount,
    addAsset,
    deleteAsset,
  };
}
