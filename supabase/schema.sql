-- Administrador de Inversiones — schema + RLS
-- Run this once in the Supabase SQL Editor of a fresh project.

create extension if not exists pgcrypto;

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('broker','billetera','exchange','efectivo')),
  currency text not null check (currency in ('ARS','USD')),
  created_at timestamptz not null default now()
);
create index accounts_user_id_idx on accounts(user_id);

create table assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  ticker text not null,
  name text not null,
  category text not null check (category in ('Acción','CEDEAR','Cripto','Fondo money market','Efectivo')),
  currency text not null check (currency in ('ARS','USD')),
  kind text not null default 'position' check (kind in ('position','fund')),
  current_price numeric,           -- required for kind='position'; the hook point for the future live-price phase
  fund_value numeric,              -- required for kind='fund'
  fund_gain_abs numeric,
  fund_tna numeric,
  created_at timestamptz not null default now(),
  constraint assets_kind_shape check (
    (kind = 'position' and current_price is not null
       and fund_value is null and fund_gain_abs is null and fund_tna is null)
    or
    (kind = 'fund' and current_price is null and fund_value is not null)
  )
);
create index assets_user_id_idx on assets(user_id);
create index assets_account_id_idx on assets(account_id);

create table asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, -- denormalized for simple RLS
  qty numeric not null check (qty > 0),
  price numeric not null check (price > 0),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index asset_history_asset_id_idx on asset_history(asset_id);
create index asset_history_user_id_idx on asset_history(user_id);

alter table accounts enable row level security;
alter table assets enable row level security;
alter table asset_history enable row level security;

create policy accounts_select_own on accounts for select using (auth.uid() = user_id);
create policy accounts_insert_own on accounts for insert with check (auth.uid() = user_id);
create policy accounts_update_own on accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy accounts_delete_own on accounts for delete using (auth.uid() = user_id);

create policy assets_select_own on assets for select using (auth.uid() = user_id);
create policy assets_insert_own on assets for insert with check (
  auth.uid() = user_id
  and exists (select 1 from accounts a where a.id = assets.account_id and a.user_id = auth.uid())
);
create policy assets_update_own on assets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy assets_delete_own on assets for delete using (auth.uid() = user_id);

create policy asset_history_select_own on asset_history for select using (auth.uid() = user_id);
create policy asset_history_insert_own on asset_history for insert with check (
  auth.uid() = user_id
  and exists (select 1 from assets ax where ax.id = asset_history.asset_id and ax.user_id = auth.uid())
);
-- No update/delete policy on asset_history: purchase lots are an immutable ledger in this phase.
