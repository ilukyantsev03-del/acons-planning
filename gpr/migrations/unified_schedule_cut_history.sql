create or replace function public.gpr_cut_state(p_schedule text,p_day date)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare cutoff timestamptz; taskmap jsonb; stagemap jsonb; opts jsonb; e record; restored jsonb; available_at timestamptz;
begin
 if not public.gpr_can_read(p_schedule) then raise exception 'График недоступен' using errcode='42501'; end if;
 if p_day is null or p_day<date '2026-11-17' or p_day>(now() at time zone 'Europe/Moscow')::date then
  raise exception 'Выберите дату с 17.11.2026 по сегодняшний день';
 end if;
 cutoff=((p_day+1)::timestamp at time zone 'Europe/Moscow');
 select coalesce(jsonb_object_agg(id,data),'{}'::jsonb) into taskmap from public.gpr_items where schedule_id=p_schedule and kind='task';
 select coalesce(jsonb_object_agg(id,data),'{}'::jsonb) into stagemap from public.gpr_items where schedule_id=p_schedule and kind='stage';
 select data into opts from public.gpr_items where schedule_id=p_schedule and kind='meta' and id='settings';
 -- Reverse audit replay reconstructs the real state, including deleted positions.
 for e in select kind,item_id,action,old_data from public.gpr_history where schedule_id=p_schedule and changed_at>=cutoff and (kind in ('task','stage') or kind='meta' and item_id='settings') order by changed_at desc,id desc loop
  restored=case when e.action='INSERT' then null else e.old_data end;
  if e.kind='task' then
   if restored is null then taskmap=taskmap-e.item_id; else taskmap=jsonb_set(taskmap,array[e.item_id],restored); end if;
  elsif e.kind='stage' then
   if restored is null then stagemap=stagemap-e.item_id; else stagemap=jsonb_set(stagemap,array[e.item_id],restored); end if;
  else opts=restored;
  end if;
 end loop;
 if taskmap='{}'::jsonb or opts is null then return jsonb_build_object('available',false,'day',p_day,'historyStart','2026-11-17'); end if;
 select max(changed_at) into available_at from public.gpr_history where schedule_id=p_schedule and changed_at<cutoff and (kind in ('task','stage') or kind='meta' and item_id='settings');
 return jsonb_build_object('available',true,'day',p_day,'at',available_at,'historyStart','2026-11-17','state',jsonb_build_object('tasks',(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_each(taskmap)),'stages',(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_each(stagemap)),'settings',coalesce(opts,'{}'::jsonb)||jsonb_build_object('historyStart','2026-11-17')));
end $fn$;
revoke all on function public.gpr_cut_state(text,date) from public;
grant execute on function public.gpr_cut_state(text,date) to anon,authenticated;
comment on function public.gpr_cut_state(text,date) is 'History from 2026-11-17. Checks schedule read permission; returns schedule values only, never audit identities.';
