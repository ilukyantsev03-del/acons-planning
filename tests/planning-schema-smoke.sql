begin;
do $$
declare pid uuid; v1 uuid; v2 uuid; t1 uuid; t2 uuid; mid uuid;
begin
select id into pid from public.projects where external_id='LIV-MAIN';
if pid is null then raise exception 'Project missing'; end if;
insert into public.schedule_versions(project_id,external_id,name,version_no,status,effective_date)
values(pid,'TEST-PLANNING-V1','TEST-PLANNING',1,'accepted','2026-10-15') returning id into v1;
insert into public.schedule_versions(project_id,external_id,name,version_no,status,effective_date)
values(pid,'TEST-PLANNING-V2','TEST-PLANNING',2,'accepted','2026-10-16') returning id into v2;
insert into public.schedule_tasks(project_id,external_id,version_id,source_task_id,title,duration_days,current_start,current_end,custom_data)
values(pid,'TEST-PLANNING-T1',v1,'row:5:1','Тестовая работа',3,'2026-10-15','2026-10-17','{"element":"БП","scheduleRole":"contractor","logicalId":"test-front"}') returning id into t1;
insert into public.schedule_tasks(project_id,external_id,version_id,source_task_id,title,duration_days,current_start,current_end,custom_data)
values(pid,'TEST-PLANNING-T2',v2,'row:5:1','Тестовая работа',5,'2026-10-15','2026-10-19','{"planning":{"mode":"productivity","rate":2,"resources":3}}') returning id into t2;
begin
insert into public.schedule_tasks(project_id,external_id,version_id,source_task_id,title)
values(pid,'TEST-PLANNING-DUP',v1,'row:5:1','Недопустимый дубль');
raise exception 'Duplicate source ID accepted';
exception when unique_violation then null;
end;
insert into public.milestones(project_id,external_id,title,contract_date,work_date,schedule_task_id)
values(pid,'TEST-PLANNING-KD','Тестовая КД','2026-10-17','2026-10-17',t1) returning id into mid;
update public.milestones set schedule_task_id=t2,work_date='2026-10-19' where id=mid;
if (select contract_date from public.milestones where id=mid)<>'2026-10-17'::date then raise exception 'Contract date changed'; end if;
update public.schedule_versions set status='archived' where id=v1;
if not exists(select 1 from public.schedule_tasks where id=t1) then raise exception 'History lost'; end if;
end $$;
rollback;
select 'PASS: versions, source ID uniqueness, task metadata, milestone links; all test writes rolled back' as result;
