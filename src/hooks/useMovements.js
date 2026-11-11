import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// La migración 006 todavía no se corrió: la tabla/función no existe.
export function isMissingMigration(error) {
  if (!error) return false;
  const msg = String(error.message ?? '');
  return (
    error.code === '42P01' ||
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    /does not exist|could not find the (table|function)/i.test(msg)
  );
}

// "YYYY-MM" del mes actual (hora local).
export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(key) {
  return { from: `${key}-01`, to: `${shiftMonth(key, 1)}-01` };
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function monthLabel(key, withYear = false) {
  const [y, m] = key.split('-').map(Number);
  const name = MONTHS[m - 1];
  const cap = name[0].toUpperCase() + name.slice(1);
  return withYear ? `${cap} ${y}` : cap;
}

// Días que faltan del mes (incluye hoy) y fracción transcurrida.
export function monthProgress(key) {
  const [y, m] = key.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const now = new Date();
  if (key !== currentMonthKey()) {
    const past = new Date(y, m - 1, 1) < now;
    return { days, left: past ? 0 : days, elapsed: past ? 1 : 0 };
  }
  const day = now.getDate();
  return { days, left: days - day + 1, elapsed: day / days };
}

export function useCategories(user, version) {
  const [categories, setCategories] = useState([]);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    let { data, error } = await supabase
      .from('categories')
      .select('id, name, emoji, kind, monthly_budget, sort_order, archived')
      .order('kind')
      .order('sort_order')
      .order('created_at');
    if (isMissingMigration(error)) {
      setMissing(true);
      return;
    }
    if (!error && data && data.length === 0) {
      await supabase.rpc('seed_default_categories');
      ({ data } = await supabase
        .from('categories')
        .select('id, name, emoji, kind, monthly_budget, sort_order, archived')
        .order('kind')
        .order('sort_order')
        .order('created_at'));
    }
    setMissing(false);
    setCategories((data ?? []).map((c) => ({ ...c, monthly_budget: c.monthly_budget == null ? null : Number(c.monthly_budget) })));
  }, [user]);

  useEffect(() => {
    load();
  }, [load, version]);

  return { categories, missing, reload: load };
}

export function useMonthMovements(user, monthKey, version) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const { from, to } = monthRange(monthKey);
    setLoading(true);
    supabase
      .from('movements')
      .select('id, type, amount, currency, from_account_id, to_account_id, category_id, note, occurred_on, source, created_at')
      .gte('occurred_on', from)
      .lt('occurred_on', to)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        setMissing(isMissingMigration(error));
        setMovements((data ?? []).map((m) => ({ ...m, amount: Number(m.amount) })));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, monthKey, version]);

  return { movements, loading, missing };
}

// Totales del mes en ARS (lo que está en USD se convierte al blue).
export function summarizeMonth(movements, usdArs) {
  const toArs = (m) => (m.currency === 'USD' ? m.amount * usdArs : m.amount);
  let expenses = 0;
  let income = 0;
  const byCategory = {};
  for (const m of movements) {
    if (m.type === 'expense') {
      const v = toArs(m);
      expenses += v;
      const k = m.category_id ?? 'none';
      byCategory[k] = (byCategory[k] ?? 0) + v;
    } else if (m.type === 'income') {
      income += toArs(m);
    }
  }
  return { expenses, income, byCategory };
}

export const movementActions = {
  async register(payload) {
    const { data, error } = await supabase.rpc('register_movement', {
      p_type: payload.type,
      p_amount: payload.amount,
      p_currency: payload.currency,
      p_from_account: payload.fromAccountId ?? null,
      p_to_account: payload.toAccountId ?? null,
      p_category: payload.categoryId ?? null,
      p_note: payload.note || null,
      p_occurred_on: payload.date || null,
      p_usd_rate: payload.usdRate ?? null,
      p_source: 'web',
    });
    if (error) throw new Error(isMissingMigration(error) ? 'Falta correr la migración 006 en Supabase.' : error.message);
    return data;
  },
  async remove(id) {
    const { error } = await supabase.rpc('delete_movement', { p_id: id });
    if (error) throw new Error(error.message);
  },
  async setBudget(categoryId, budget) {
    const { error } = await supabase
      .from('categories')
      .update({ monthly_budget: budget > 0 ? budget : null })
      .eq('id', categoryId);
    if (error) throw new Error(error.message);
  },
  async addCategory(userId, { name, emoji, kind, sortOrder }) {
    const { error } = await supabase
      .from('categories')
      .insert({ user_id: userId, name: name.trim(), emoji: emoji || null, kind, sort_order: sortOrder ?? 99 });
    if (error) throw new Error(error.code === '23505' ? 'Ya existe una categoría con ese nombre.' : error.message);
  },
  async archiveCategory(categoryId) {
    const { error } = await supabase.from('categories').update({ archived: true }).eq('id', categoryId);
    if (error) throw new Error(error.message);
  },
};

export function useApiTokens(user, enabled) {
  const [tokens, setTokens] = useState([]);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!user || !enabled) return;
    const { data, error } = await supabase
      .from('api_tokens')
      .select('id, name, token_hint, created_at, last_used_at, revoked_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    setMissing(isMissingMigration(error));
    setTokens(data ?? []);
  }, [user, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (name) => {
    const { data, error } = await supabase.rpc('create_api_token', { p_name: name });
    if (error) throw new Error(isMissingMigration(error) ? 'Falta correr la migración 006 en Supabase.' : error.message);
    await load();
    return data;
  };
  const revoke = async (id) => {
    const { error } = await supabase.from('api_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    await load();
  };

  return { tokens, missing, create, revoke };
}
