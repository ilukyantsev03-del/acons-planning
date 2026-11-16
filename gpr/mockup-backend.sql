-- Atomic writes and dated states for the independent mockup schedule.
create or replace function public.gpr_mockup_save(p_schedule text, p_revision integer, p_changes jsonb default '[]', p_baseline_name text default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare c jsonb; n integer; r integer; snap jsonb; task_map jsonb; archive_id text; moment text := to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if not coalesce(public.gpr_can_write(p_schedule),false) then raise exception 'Редактирование доступно только владельцу'; end if;
 perform pg_advisory_xact_lock(hashtextextended('gpr-mockup:'||p_schedule,0));
 if not exists(select 1 from public.gpr_items where schedule_id=p_schedule and kind='meta' and id='settings' and data->>'profile'='mockup') then raise exception 'Неверный профиль графика'; end if;
 select version into r from public.gpr_items where schedule_id=p_schedule and kind='meta' and id='revision' for update;
 if r is distinct from p_revision then raise exception 'График изменён в другом окне. Обновите страницу перед сохранением'; end if;
 if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>500 then raise exception 'Некорректный пакет изменений'; end if;
 for c in select value from jsonb_array_elements(p_changes) loop
  if c->>'kind' not in ('task','stage') and not(c->>'kind'='meta' and c->>'id'='settings') then raise exception 'Недопустимый вид записи'; end if;
  if c->>'op'='delete' then
   delete from public.gpr_items where schedule_id=p_schedule and kind=c->>'kind' and id=c->>'id' and version=(c->>'version')::integer;
  elsif (c->>'version') is null then
   insert into public.gpr_items(schedule_id,kind,id,data)values(p_schedule,c->>'kind',c->>'id',c->'data');
  else
   update public.gpr_items set data=c->'data' where schedule_id=p_schedule and kind=c->>'kind' and id=c->>'id' and version=(c->>'version')::integer;
  end if;
  get diagnostics n = row_count;
  if n<>1 then raise exception 'Запись изменена другим пользователем. Обновите график'; end if;
 end loop;
 -- Read the secured rows once. Validate the snapshot in memory, avoiding
 -- repeated per-row RLS lookups inside predecessor/parent joins.
 select jsonb_build_object('tasks',coalesce(jsonb_agg(data order by (data->>'order')::numeric)filter(where kind='task'),'[]'),'stages',coalesce(jsonb_agg(data)filter(where kind='stage'),'[]'),'settings',coalesce((select data from public.gpr_items where schedule_id=p_schedule and kind='meta' and id='settings'),'{}')) into snap from public.gpr_items where schedule_id=p_schedule and kind in ('task','stage');
 select jsonb_object_agg(t->>'id',t) into task_map from jsonb_array_elements(snap->'tasks') t;
 if exists(select 1 from jsonb_array_elements(snap->'tasks') t cross join lateral jsonb_array_elements(coalesce(t->'preds','[]')) p where not (task_map ? (p->>'id'))) then raise exception 'Связь с отсутствующей работой'; end if;
 if exists(select 1 from jsonb_array_elements(snap->'tasks') t where t->>'parent' is not null and coalesce(task_map->(t->>'parent')->>'summary','false')<>'true') then raise exception 'Не найдена родительская группа'; end if;
 if exists(with recursive edges as materialized (
  select t->>'id' a,p->>'id' b from jsonb_array_elements(snap->'tasks') t cross join lateral jsonb_array_elements(coalesce(t->'preds','[]'))p
  union select t->>'id',t->>'parent' from jsonb_array_elements(snap->'tasks')t where t->>'parent' is not null
 ),walk as(select a,b,array[a] path,a=b cycle from edges union all select w.a,e.b,w.path||w.b,e.b=any(w.path||w.b) from walk w join edges e on e.a=w.b where not w.cycle)select 1 from walk where cycle) then raise exception 'Замкнутый круг в связях или группах'; end if;
 update public.gpr_items set data=jsonb_build_object('savedAt',moment) where schedule_id=p_schedule and kind='meta' and id='revision' returning version into r;
 archive_id:=case when p_baseline_name is null then 'state-' else 'baseline-' end||gen_random_uuid()::text;
 insert into public.gpr_items(schedule_id,kind,id,data)values(p_schedule,'meta',archive_id,jsonb_build_object('at',moment,'label',coalesce(nullif(trim(p_baseline_name),''),'Сохранение графика'),'state',snap));
 return jsonb_build_object('revision',r,'archiveId',archive_id,'at',moment);
end $$;
revoke all on function public.gpr_mockup_save(text,integer,jsonb,text) from public,anon;
grant execute on function public.gpr_mockup_save(text,integer,jsonb,text) to authenticated;
create index if not exists gpr_items_archive_time on public.gpr_items(schedule_id,kind,(data->>'at') desc) where kind='meta';
