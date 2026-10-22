-- Add independent project snapshots. Existing liv_settings data is preserved.
create table public.construction_project_snapshots (
 project_id uuid primary key references public.projects(id) on delete restrict,
 project jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 constraint snapshot_construction_identity check (jsonb_typeof(project) = 'object')
);
alter table public.construction_project_snapshots enable row level security;
revoke all on public.construction_project_snapshots from anon;
grant select,insert,update on public.construction_project_snapshots to authenticated;
create policy construction_snapshots_read on public.construction_project_snapshots for select to authenticated
 using (private.can_read_project(project_id) or private.can_write_project(project_id));
create policy construction_snapshots_insert on public.construction_project_snapshots for insert to authenticated
 with check (private.can_write_project(project_id));
create policy construction_snapshots_update on public.construction_project_snapshots for update to authenticated
 using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
-- Enforce document ownership and monotonically increasing revisions server-side too.
create function public.validate_construction_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.project->'meta'->>'constructionId') is distinct from
    (select external_id from public.projects where id=new.project_id) then
   raise exception 'Snapshot construction identity mismatch';
 end if;
 if tg_op='UPDATE' and (new.project_id<>old.project_id or new.revision<>old.revision+1) then
   raise exception 'Snapshot revision mismatch';
 end if;
 new.updated_by=auth.uid(); new.updated_at=now();
 return new;
end;
$$;
revoke all on function public.validate_construction_snapshot() from public,anon,authenticated;
create trigger validate_construction_snapshot before insert or update on public.construction_project_snapshots
 for each row execute function public.validate_construction_snapshot();
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.construction_project_snapshots;
 end if;
end $$;

-- Dictionaries belong to construction projects too. Keep every existing row and ID.
alter table public.organizations add column project_id uuid references public.projects(id);
alter table public.works add column project_id uuid references public.projects(id);
update public.organizations set project_id=(select id from public.projects where external_id='LIV-MAIN') where project_id is null;
update public.works set project_id=(select id from public.projects where external_id='LIV-MAIN') where project_id is null;
alter table public.organizations drop constraint organizations_name_key;
alter table public.works drop constraint works_name_key;
create unique index organizations_project_name_uq on public.organizations(project_id,name);
create unique index works_project_name_uq on public.works(project_id,name);
