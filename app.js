-- ACONS Planning — рабочая схема базы данных
-- Выполнять в редакторе запросов Supabase после создания проекта.

create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (
    role in (
      'admin',
      'planner',
      'responsible',
      'customer',
      'contractor'
    )
  ),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists works (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists structures (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  block_name text,
  floor_no numeric,
  side_name text,
  zone_name text,
  created_at timestamptz not null default now()
);

create table if not exists fronts (
  id uuid primary key default gen_random_uuid(),

  structure_id uuid not null references structures(id) on delete cascade,
  work_id uuid not null references works(id),

  status text not null default 'Не начато',

  fact_text text,
  current_people numeric,
  constraint_text text,

  contractor_name text,
  responsible_name text,

  contract_start date,
  contract_end date,

  baseline_start date,
  baseline_end date,

  plan_start date,
  plan_end date,

  fact_start date,
  fact_end date,

  forecast_end date,

  unit text,
  total_qty numeric,
  done_qty numeric,

  completed boolean not null default false,
  presented boolean not null default false,
  accepted boolean not null default false,
  accepted_date date,

  owner_user_id uuid references app_users(id),

  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique(structure_id, work_id)
);

create table if not exists plan_log (
  id uuid primary key default gen_random_uuid(),

  front_id uuid not null references fronts(id) on delete cascade,

  plan_date date not null,

  planned_qty numeric not null default 0,
  planned_people numeric not null default 0,

  comment text,

  created_by uuid references app_users(id),

  created_at timestamptz not null default now()
);

create table if not exists fact_log (
  id uuid primary key default gen_random_uuid(),

  front_id uuid not null references fronts(id) on delete cascade,

  fact_date date not null,

  qty numeric not null default 0,
  cumulative_qty numeric,

  people numeric not null default 0,

  status text,
  comment text,

  created_by uuid references app_users(id),

  created_at timestamptz not null default now()
);

create table if not exists handover_log (
  id uuid primary key default gen_random_uuid(),

  front_id uuid not null references fronts(id) on delete cascade,

  event_date date not null,

  event_type text not null check (
    event_type in (
      'completed',
      'presented',
      'accepted',
      'returned'
    )
  ),

  comment text,

  created_by uuid references app_users(id),

  created_at timestamptz not null default now()
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

  forecast_end date,

  predecessor_id uuid references demolition_objects(id),

  link_type text not null default 'Окончание → Начало',

  lag_days integer not null default 0,

  presented boolean not null default false,
  accepted boolean not null default false,
  accepted_date date,

  comment text,

  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists access_scope (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  building_id uuid references buildings(id) on delete cascade,

  can_read boolean not null default true,
  can_write boolean not null default false,

  can_edit_contract_dates boolean not null default false,
  can_view_internal_comments boolean not null default false,
  can_view_people boolean not null default false,

  created_at timestamptz not null default now(),

  unique(user_id, building_id)
);

create table if not exists change_log (
  id uuid primary key default gen_random_uuid(),

  entity_type text not null,
  entity_id uuid not null,

  field_name text not null,

  old_value text,
  new_value text,

  changed_by uuid references app_users(id),

  changed_at timestamptz not null default now()
);

create index if not exists idx_plan_log_front_date
  on plan_log(front_id, plan_date);

create index if not exists idx_fact_log_front_date
  on fact_log(front_id, fact_date);

create index if not exists idx_fronts_structure
  on fronts(structure_id);

create index if not exists idx_structures_building
  on structures(building_id);

alter table app_users enable row level security;
alter table buildings enable row level security;
alter table works enable row level security;
alter table structures enable row level security;
alter table fronts enable row level security;
alter table plan_log enable row level security;
alter table fact_log enable row level security;
alter table handover_log enable row level security;
alter table demolition_objects enable row level security;
alter table access_scope enable row level security;
alter table change_log enable row level security;

-- ВАЖНО:
-- Политики доступа добавляем после создания первого администратора.
-- До этого не вставляй секретные ключи в app.js.
--
-- Планируемая логика:
--
-- Администратор:
-- полный доступ.
--
-- Планировщик:
-- полный рабочий доступ к разрешенным объектам.
--
-- Ответственный:
-- факт, люди, статусы и ограничения по своим объектам.
--
-- Подрядчик:
-- свои фронты и ввод факта,
-- без изменения договорных дат.
--
-- Заказчик:
-- только чтение разрешенных зданий
-- и согласованных отчетных данных.