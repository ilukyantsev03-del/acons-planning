create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'responsible'
    check (
      role in (
        'admin',
        'planner',
        'responsible',
        'contractor',
        'customer'
      )
    ),
  organization_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.app_users
  drop constraint if exists app_users_organization_id_fkey;

alter table public.app_users
  add constraint app_users_organization_id_fkey
  foreign key (organization_id)
  references public.organizations(id)
  on delete set null;

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  name text not null,

  scope text not null
    check (
      scope in (
        'structure',
        'front'
      )
    ),

  field_type text not null
    check (
      field_type in (
        'text',
        'number',
        'date',
        'boolean',
        'select',
        'percent'
      )
    ),

  options jsonb not null default '[]'::jsonb,

  active boolean not null default true,

  created_at timestamptz not null default now()
);

create table if not exists public.structures (
  id uuid primary key default gen_random_uuid(),

  building_id uuid not null
    references public.buildings(id)
    on delete cascade,

  block_name text,
  floor_no numeric,
  capture_name text,
  axis_name text,
  side_name text,
  zone_name text,

  room_number text,
  room_name text,
  equipment_name text,

  fsm_priority text,
  fsm_status text,

  custom_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create table if not exists public.fronts (
  id uuid primary key default gen_random_uuid(),

  structure_id uuid not null
    references public.structures(id)
    on delete cascade,

  work_id uuid not null
    references public.works(id)
    on delete cascade,

  organization_id uuid
    references public.organizations(id)
    on delete set null,

  responsible text,

  status text not null default 'Не начато',

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

  current_people numeric,

  completed boolean not null default false,
  presented boolean not null default false,
  accepted boolean not null default false,

  accepted_date date,

  fact_text text,
  constraint_text text,

  custom_data jsonb not null default '{}'::jsonb,

  updated_at timestamptz not null default now(),

  unique (
    structure_id,
    work_id
  )
);

create table if not exists public.plan_log (
  id uuid primary key default gen_random_uuid(),

  front_id uuid not null
    references public.fronts(id)
    on delete cascade,

  plan_date date not null,

  planned_qty numeric not null default 0,

  planned_people numeric not null default 0,

  comment text,

  created_by uuid
    references public.app_users(id),

  created_at timestamptz not null default now()
);

create table if not exists public.fact_log (
  id uuid primary key default gen_random_uuid(),

  front_id uuid not null
    references public.fronts(id)
    on delete cascade,

  fact_date date not null,

  qty numeric not null default 0,

  cumulative_qty numeric,

  people numeric not null default 0,

  comment text,

  created_by uuid
    references public.app_users(id),

  created_at timestamptz not null default now()
);

create table if not exists public.resource_log (
  id uuid primary key default gen_random_uuid(),

  resource_date date not null,

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  building_id uuid
    references public.buildings(id)
    on delete set null,

  itr integer not null default 0,

  workers integer not null default 0,

  mechanizers integer not null default 0,

  equipment_type text,

  equipment_qty numeric not null default 0,

  comment text,

  created_by uuid
    references public.app_users(id),

  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),

  building_id uuid
    references public.buildings(id)
    on delete set null,

  title text not null,

  contract_date date,
  work_date date,
  forecast_date date,
  fact_date date,

  status text not null default 'Не наступила',

  comment text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create table if not exists public.matrix_views (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  owner_user_id uuid
    references public.app_users(id)
    on delete cascade,

  is_shared boolean not null default false,

  columns jsonb not null default '[]'::jsonb,

  filters jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create table if not exists public.access_scope (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.app_users(id)
    on delete cascade,

  building_id uuid
    references public.buildings(id)
    on delete cascade,

  can_read boolean not null default true,

  can_write boolean not null default false,

  can_edit_schedule boolean not null default false,

  can_view_resources boolean not null default true,

  can_view_internal_comments boolean not null default false,

  unique (
    user_id,
    building_id
  )
);

create table if not exists public.change_log (
  id uuid primary key default gen_random_uuid(),

  entity_type text not null,

  entity_id uuid,

  field_name text not null,

  old_value text,

  new_value text,

  changed_by uuid
    references public.app_users(id),

  changed_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$

begin

  insert into public.app_users (
    id,
    email,
    full_name,
    role
  )

  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      ''
    ),
    'responsible'
  )

  on conflict (id)
  do nothing;

  return new;

end;

$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert
on auth.users
for each row
execute procedure public.handle_new_user();

create or replace function public.is_admin_or_planner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$

  select exists (

    select 1

    from public.app_users u

    where
      u.id = auth.uid()
      and u.active
      and u.role in (
        'admin',
        'planner'
      )

  );

$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$

  select role

  from public.app_users

  where id = auth.uid();

$$;

alter table public.app_users enable row level security;
alter table public.organizations enable row level security;
alter table public.buildings enable row level security;
alter table public.works enable row level security;
alter table public.custom_fields enable row level security;
alter table public.structures enable row level security;
alter table public.fronts enable row level security;
alter table public.plan_log enable row level security;
alter table public.fact_log enable row level security;
alter table public.resource_log enable row level security;
alter table public.milestones enable row level security;
alter table public.matrix_views enable row level security;
alter table public.access_scope enable row level security;
alter table public.change_log enable row level security;

create policy "authenticated read users"
on public.app_users
for select
to authenticated
using (true);

create policy "authenticated read organizations"
on public.organizations
for select
to authenticated
using (true);

create policy "authenticated read buildings"
on public.buildings
for select
to authenticated
using (true);

create policy "authenticated read works"
on public.works
for select
to authenticated
using (true);

create policy "authenticated read custom_fields"
on public.custom_fields
for select
to authenticated
using (true);

create policy "authenticated read structures"
on public.structures
for select
to authenticated
using (true);

create policy "authenticated read fronts"
on public.fronts
for select
to authenticated
using (true);

create policy "authenticated read plan_log"
on public.plan_log
for select
to authenticated
using (true);

create policy "authenticated read fact_log"
on public.fact_log
for select
to authenticated
using (true);

create policy "authenticated read resource_log"
on public.resource_log
for select
to authenticated
using (true);

create policy "authenticated read milestones"
on public.milestones
for select
to authenticated
using (true);

create policy "authenticated read history"
on public.change_log
for select
to authenticated
using (true);

create policy "views visible"
on public.matrix_views
for select
to authenticated
using (
  is_shared
  or
  owner_user_id = auth.uid()
);

create policy "scope visible"
on public.access_scope
for select
to authenticated
using (
  user_id = auth.uid()
  or
  public.is_admin_or_planner()
);

create policy "manage organizations"
on public.organizations
for all
to authenticated
using (
  public.is_admin_or_planner()
)
with check (
  public.is_admin_or_planner()
);

create policy "manage buildings"
on public.buildings
for all
to authenticated
using (
  public.is_admin_or_planner()
)
with check (
  public.is_admin_or_planner()
);

create policy "manage works"
on public.works
for all
to authenticated
using (
  public.is_admin_or_planner()
)
with check (
  public.is_admin_or_planner()
);

create policy "manage custom_fields"
on public.custom_fields
for all
to authenticated
using (
  public.is_admin_or_planner()
)
with check (
  public.is_admin_or_planner()
);

create policy "manage structures"
on public.structures
for all
to authenticated
using (
  public.is_admin_or_planner()
)
with check (
  public.is_admin_or_planner()
);

create policy "manage fronts"
on public.fronts
for all
to authenticated
using (
  public.is_admin_or_planner()
)
with check (
  public.is_admin_or_planner()
);

create policy "manage milestones"
on public.milestones
for all
to authenticated
using (
  public.is_admin_or_planner()
)
with check (
  public.is_admin_or_planner()
);

create policy "manage scopes"
on public.access_scope
for all
to authenticated
using (
  public.is_admin_or_planner()
)
with check (
  public.is_admin_or_planner()
);

create policy "manage plan"
on public.plan_log
for all
to authenticated
using (
  public.is_admin_or_planner()
)
with check (
  public.is_admin_or_planner()
);

create policy "insert fact"
on public.fact_log
for insert
to authenticated
with check (
  public.my_role()
  in (
    'admin',
    'planner',
    'responsible',
    'contractor'
  )
);

create policy "update own or planner fact"
on public.fact_log
for update
to authenticated
using (
  public.is_admin_or_planner()
  or
  created_by = auth.uid()
)
with check (
  public.is_admin_or_planner()
  or
  created_by = auth.uid()
);

create policy "delete own or planner fact"
on public.fact_log
for delete
to authenticated
using (
  public.is_admin_or_planner()
  or
  created_by = auth.uid()
);

create policy "insert resources"
on public.resource_log
for insert
to authenticated
with check (
  public.my_role()
  in (
    'admin',
    'planner',
    'responsible',
    'contractor'
  )
);

create policy "update own or planner resources"
on public.resource_log
for update
to authenticated
using (
  public.is_admin_or_planner()
  or
  created_by = auth.uid()
)
with check (
  public.is_admin_or_planner()
  or
  created_by = auth.uid()
);

create policy "delete own or planner resources"
on public.resource_log
for delete
to authenticated
using (
  public.is_admin_or_planner()
  or
  created_by = auth.uid()
);

create policy "insert own views"
on public.matrix_views
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and
  (
    not is_shared
    or
    public.is_admin_or_planner()
  )
);

create policy "update own views"
on public.matrix_views
for update
to authenticated
using (
  owner_user_id = auth.uid()
  or
  public.is_admin_or_planner()
)
with check (
  owner_user_id = auth.uid()
  or
  public.is_admin_or_planner()
);

create policy "delete own views"
on public.matrix_views
for delete
to authenticated
using (
  owner_user_id = auth.uid()
  or
  public.is_admin_or_planner()
);

create policy "insert history"
on public.change_log
for insert
to authenticated
with check (
  changed_by = auth.uid()
);

create policy "admin update users"
on public.app_users
for update
to authenticated
using (
  public.my_role() = 'admin'
)
with check (
  public.my_role() = 'admin'
);

grant usage
on schema public
to authenticated;

grant select
on all tables in schema public
to authenticated;

grant insert, update, delete
on public.organizations,
   public.buildings,
   public.works,
   public.custom_fields,
   public.structures,
   public.fronts,
   public.plan_log,
   public.fact_log,
   public.resource_log,
   public.milestones,
   public.matrix_views,
   public.access_scope,
   public.change_log
to authenticated;

grant update
on public.app_users
to authenticated;

grant execute
on function public.is_admin_or_planner()
to authenticated;

grant execute
on function public.my_role()
to authenticated;

do $$

begin

  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'fronts'
  ) then

    alter publication supabase_realtime
    add table public.fronts;

  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'plan_log'
  ) then

    alter publication supabase_realtime
    add table public.plan_log;

  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'fact_log'
  ) then

    alter publication supabase_realtime
    add table public.fact_log;

  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'resource_log'
  ) then

    alter publication supabase_realtime
    add table public.resource_log;

  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'milestones'
  ) then

    alter publication supabase_realtime
    add table public.milestones;

  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'buildings'
  ) then

    alter publication supabase_realtime
    add table public.buildings;

  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'works'
  ) then

    alter publication supabase_realtime
    add table public.works;

  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'structures'
  ) then

    alter publication supabase_realtime
    add table public.structures;

  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'organizations'
  ) then

    alter publication supabase_realtime
    add table public.organizations;

  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where
      pubname = 'supabase_realtime'
      and tablename = 'matrix_views'
  ) then

    alter publication supabase_realtime
    add table public.matrix_views;

  end if;

end $$;

insert into public.buildings(name)
values
('Главный корпус'),
('Грязелечебница'),
('Ресторан с банкетным залом'),
('КПП'),
('ДЭС'),
('ТП-2'),
('ТП-3'),
('ТП-4'),
('РТП. Хладоцентр'),
('Котельная'),
('РЧВ'),
('Подпорные стены благоустройства'),
('Аэрарий')
on conflict(name)
do nothing;

insert into public.works(name)
values
('Кладка наружных стен'),
('Вертикальное армирование'),
('Штукатурка'),
('Гидроизоляция балконов'),
('Передача фронта')
on conflict(name)
do nothing;

-- После регистрации первого пользователя:
--
-- update public.app_users
-- set role='admin'
-- where email='ТВОЙ_EMAIL';

-- =========================================================
-- LIV CORE V2 — УНИВЕРСАЛЬНЫЙ ГРАФИК И ПРЕДСТАВЛЕНИЯ
-- Добавляется поверх существующей схемы без удаления старых таблиц.
-- =========================================================

alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check
  check (
    role in (
      'admin',
      'planner',
      'director',
      'project_manager',
      'responsible',
      'contractor',
      'customer'
    )
  );

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  status text not null default 'active',
  timezone text not null default 'Europe/Moscow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete set null,
  name text not null,
  task_type text not null default 'task',
  building_id uuid references public.buildings(id) on delete set null,
  block text,
  floor text,
  axis text,
  capture text,
  zone text,
  network text,
  segment text,
  work_id uuid references public.works(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  status text not null default 'Не начато',
  progress_percent numeric not null default 0,
  duration_method text not null default 'manual',
  duration_manual numeric,
  duration_calculated numeric,
  duration_accepted numeric,
  calendar_code text,
  comment text,
  source_type text,
  source_file text,
  source_sheet text,
  source_row integer,
  active boolean not null default true,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_dates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  date_type text not null
    check (date_type in (
      'customer_contract',
      'subcontract',
      'baseline',
      'working',
      'forecast',
      'actual'
    )),
  start_date date,
  finish_date date,
  source text,
  comment text,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_id, date_type)
);

create table if not exists public.task_quantities (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  quantity_type text not null default 'primary',
  name text not null,
  unit text,
  planned_qty numeric,
  is_primary boolean not null default false,
  calculation_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  predecessor_task_id uuid not null references public.tasks(id) on delete cascade,
  relation_type text not null default 'FS'
    check (relation_type in ('FS','SS','FF','SF')),
  lag_value numeric not null default 0,
  lag_unit text not null default 'day',
  created_at timestamptz not null default now(),
  unique(task_id, predecessor_task_id, relation_type, lag_value, lag_unit)
);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  owner_user_id uuid references public.app_users(id) on delete set null,
  name text not null,
  view_type text not null default 'table'
    check (view_type in (
      'table',
      'schedule',
      'matrix',
      'gantt',
      'linear',
      'planfact',
      'dashboard',
      'network'
    )),
  config jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.view_access (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references public.saved_views(id) on delete cascade,
  user_id uuid references public.app_users(id) on delete cascade,
  role text,
  can_view boolean not null default true,
  can_export boolean not null default true,
  unique(view_id, user_id, role),
  check (user_id is not null or role is not null)
);

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dates enable row level security;
alter table public.task_quantities enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.saved_views enable row level security;
alter table public.view_access enable row level security;

drop policy if exists "authenticated read projects" on public.projects;
create policy "authenticated read projects"
on public.projects for select
to authenticated
using (true);

drop policy if exists "authenticated read tasks" on public.tasks;
create policy "authenticated read tasks"
on public.tasks for select
to authenticated
using (true);

drop policy if exists "authenticated read task_dates" on public.task_dates;
create policy "authenticated read task_dates"
on public.task_dates for select
to authenticated
using (true);

drop policy if exists "authenticated read task_quantities" on public.task_quantities;
create policy "authenticated read task_quantities"
on public.task_quantities for select
to authenticated
using (true);

drop policy if exists "authenticated read task_dependencies" on public.task_dependencies;
create policy "authenticated read task_dependencies"
on public.task_dependencies for select
to authenticated
using (true);

drop policy if exists "planner manage projects" on public.projects;
create policy "planner manage projects"
on public.projects for all
to authenticated
using (public.is_admin_or_planner())
with check (public.is_admin_or_planner());

drop policy if exists "planner manage tasks" on public.tasks;
create policy "planner manage tasks"
on public.tasks for all
to authenticated
using (public.is_admin_or_planner())
with check (public.is_admin_or_planner());

drop policy if exists "planner manage task_dates" on public.task_dates;
create policy "planner manage task_dates"
on public.task_dates for all
to authenticated
using (public.is_admin_or_planner())
with check (public.is_admin_or_planner());

drop policy if exists "planner manage task_quantities" on public.task_quantities;
create policy "planner manage task_quantities"
on public.task_quantities for all
to authenticated
using (public.is_admin_or_planner())
with check (public.is_admin_or_planner());

drop policy if exists "planner manage task_dependencies" on public.task_dependencies;
create policy "planner manage task_dependencies"
on public.task_dependencies for all
to authenticated
using (public.is_admin_or_planner())
with check (public.is_admin_or_planner());

drop policy if exists "views readable by owner shared or granted" on public.saved_views;
create policy "views readable by owner shared or granted"
on public.saved_views for select
to authenticated
using (
  owner_user_id = auth.uid()
  or is_shared = true
  or exists (
    select 1
    from public.view_access va
    where va.view_id = saved_views.id
      and va.can_view = true
      and (
        va.user_id = auth.uid()
        or va.role = public.my_role()
      )
  )
);

drop policy if exists "planner manage saved_views" on public.saved_views;
create policy "planner manage saved_views"
on public.saved_views for all
to authenticated
using (public.is_admin_or_planner())
with check (public.is_admin_or_planner());

drop policy if exists "view access readable" on public.view_access;
create policy "view access readable"
on public.view_access for select
to authenticated
using (
  user_id = auth.uid()
  or role = public.my_role()
  or public.is_admin_or_planner()
);

drop policy if exists "planner manage view_access" on public.view_access;
create policy "planner manage view_access"
on public.view_access for all
to authenticated
using (public.is_admin_or_planner())
with check (public.is_admin_or_planner());

grant select on
  public.projects,
  public.tasks,
  public.task_dates,
  public.task_quantities,
  public.task_dependencies,
  public.saved_views,
  public.view_access
to authenticated;

grant insert, update, delete on
  public.projects,
  public.tasks,
  public.task_dates,
  public.task_quantities,
  public.task_dependencies,
  public.saved_views,
  public.view_access
to authenticated;
