-- ACONS Planning: базовая схема для Supabase/PostgreSQL
create table if not exists app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('admin','planner','responsible','customer','contractor')),
  active boolean default true
);

create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table if not exists works (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean default true
);

create table if not exists structures (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  block_name text,
  floor_no numeric,
  side_name text
);

create table if not exists fronts (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references structures(id) on delete cascade,
  work_id uuid not null references works(id),
  status text not null default 'Не начато',
  fact_text text,
  people numeric,
  constraint_text text,
  contract_start date,
  contract_end date,
  plan_start date,
  plan_end date,
  fact_start date,
  fact_end date,
  unit text,
  total_qty numeric,
  done_qty numeric,
  presented boolean default false,
  accepted boolean default false,
  owner_user_id uuid references app_users(id),
  contractor_name text,
  updated_at timestamptz default now()
);

create table if not exists fact_log (
  id uuid primary key default gen_random_uuid(),
  front_id uuid not null references fronts(id) on delete cascade,
  fact_date date not null,
  qty numeric default 0,
  cumulative_qty numeric,
  people numeric default 0,
  status text,
  comment text,
  created_by uuid references app_users(id),
  created_at timestamptz default now()
);

create table if not exists demolition_objects (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  status text not null default 'Не начато',
  contract_start date,
  contract_end date,
  plan_start date,
  plan_end date,
  fact_start date,
  fact_end date,
  predecessor_id uuid references demolition_objects(id),
  link_type text default 'FS',
  lag_days integer default 0,
  presented boolean default false,
  accepted boolean default false,
  comment text
);

create table if not exists access_scope (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  building_id uuid references buildings(id) on delete cascade,
  can_read boolean default true,
  can_write boolean default false
);

alter table buildings enable row level security;
alter table works enable row level security;
alter table structures enable row level security;
alter table fronts enable row level security;
alter table fact_log enable row level security;
alter table demolition_objects enable row level security;
alter table access_scope enable row level security;

-- Политику RLS лучше настроить после создания первого admin.
-- Идея:
-- admin/planner: полный доступ;
-- responsible/contractor: запись только в разрешенные building_id/fronts;
-- customer: только SELECT в разрешенных building_id.