create or replace function public.gpr_task_baseline(
 p_schedule text,p_task text,p_baseline text,p_task_version integer,p_baseline_version integer,p_start text,p_finish text
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare t jsonb;b jsonb;settings jsonb;tv integer;bv integer;before_value jsonb;after_value jsonb;moment text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');mock boolean;count_target integer;
begin
 if auth.uid() is null or not coalesce(public.gpr_can_write(p_schedule),false) then raise exception 'Редактирование доступно только владельцу графика';end if;
 if p_baseline is null or (p_baseline<>'baseline' and p_baseline not like 'baseline-%') then raise exception 'Выберите базовый план';end if;
 if p_finish is null or p_finish='' or (p_start is not null and p_start<>'' and p_start::timestamp>p_finish::timestamp) then raise exception 'Укажите корректные текущие сроки работы';end if;
 perform pg_advisory_xact_lock(hashtextextended('gpr-mockup:'||p_schedule,0));
 select data into settings from public.gpr_items where schedule_id=p_schedule and kind='meta' and id='settings';mock:=settings->>'profile'='mockup';
 select data,version into t,tv from public.gpr_items where schedule_id=p_schedule and kind='task' and id=p_task for update;
 if t is null or tv is distinct from p_task_version then raise exception 'Работа изменена. Обновите график';end if;
 if coalesce((t->>'summary')::boolean,false) then raise exception 'Выберите отдельную работу, а не раздел';end if;
 if mock and ((nullif(t->>'start','')::timestamp is distinct from nullif(p_start,'')::timestamp) or (nullif(t->>'finish','')::timestamp is distinct from p_finish::timestamp)) then raise exception 'Текущие сроки изменились. Обновите график';end if;
 select data,version into b,bv from public.gpr_items where schedule_id=p_schedule and kind='meta' and id=p_baseline for update;
 if bv is distinct from p_baseline_version then raise exception 'Базовый план изменён. Обновите график';end if;
 if mock then
  b:=coalesce(b,jsonb_build_object('at',moment,'label','Базовый план · отдельные работы','state',jsonb_build_object('tasks','[]'::jsonb,'stages','[]'::jsonb,'settings','{}'::jsonb)));
  if jsonb_typeof(b->'state'->'tasks') is distinct from 'array' then raise exception 'Неизвестный формат базового плана';end if;
  select count(*),jsonb_agg(x)->0 into count_target,before_value from jsonb_array_elements(b->'state'->'tasks') x where x->>'id'=p_task;
  if count_target>1 then raise exception 'Повторяющаяся запись в базовом плане';end if;
  after_value:=t||jsonb_build_object('start',p_start,'finish',p_finish,'baselineStart',p_start,'baselineFinish',p_finish);
  b:=jsonb_set(b,'{state,tasks}',coalesce((select jsonb_agg(case when x->>'id'=p_task then after_value else x end order by ord) from jsonb_array_elements(b->'state'->'tasks') with ordinality a(x,ord)),'[]'::jsonb)||case when count_target=0 then jsonb_build_array(after_value) else '[]'::jsonb end);
 else
  if p_baseline<>'baseline' then raise exception 'Для этого графика выберите действующую базу';end if;
  b:=coalesce(b,jsonb_build_object('date',to_char(clock_timestamp() at time zone 'Europe/Moscow','YYYY-MM-DD'),'items','{}'::jsonb,'links','{}'::jsonb));
  if jsonb_typeof(b->'items') is distinct from 'object' then raise exception 'Неизвестный формат базового плана';end if;
  before_value:=jsonb_build_object('dates',b->'items'->p_task,'links',b->'links'->p_task);after_value:=jsonb_build_array(nullif(p_start,''),p_finish);
  b:=jsonb_set(b,'{items}',(b->'items')||jsonb_build_object(p_task,after_value));b:=jsonb_set(b,'{links}',coalesce(b->'links','{}'::jsonb)||jsonb_build_object(p_task,coalesce(t->'preds','[]'::jsonb)));
 end if;
 b:=b||jsonb_build_object('taskBaselineUpdates',coalesce(b->'taskBaselineUpdates','[]'::jsonb)||jsonb_build_array(jsonb_build_object('taskId',p_task,'at',moment,'before',before_value,'start',p_start,'finish',p_finish,'by',auth.uid())));
 if bv is null then insert into public.gpr_items(schedule_id,kind,id,data) values(p_schedule,'meta',p_baseline,b);else update public.gpr_items set data=b where schedule_id=p_schedule and kind='meta' and id=p_baseline;end if;
 update public.gpr_items set data=coalesce(data,'{}'::jsonb)||jsonb_build_object('savedAt',moment,'note','Базовый план отдельной работы: '||coalesce(t->>'name',p_task)) where schedule_id=p_schedule and kind='meta' and id='revision';
 return jsonb_build_object('baselineId',p_baseline,'taskId',p_task,'start',p_start,'finish',p_finish);
end $$;
revoke execute on function public.gpr_task_baseline(text,text,text,integer,integer,text,text) from public,anon;
grant execute on function public.gpr_task_baseline(text,text,text,integer,integer,text,text) to authenticated;
