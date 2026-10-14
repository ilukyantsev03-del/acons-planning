begin;
do $$
declare pid uuid; sid uuid; mid uuid; bid uuid; gid1 uuid; gid2 uuid; v bigint; affected integer;
begin
select id into pid from public.projects where external_id='LIV-MAIN';
select id into bid from public.buildings where project_id=pid limit 1;
if pid is null or bid is null then raise exception 'Project/building missing'; end if;
insert into public.schemes(project_id,external_id,name,file_name,storage_path) values(pid,'TEST-20261014-SCHEME','Предтест','Кровля_08.10.26.pdf','schemes/TEST-20261014/source.pdf') returning id,row_version into sid,v;
if v<>1 then raise exception 'Initial version incorrect'; end if;
insert into public.scheme_marks(project_id,scheme_id,external_id,page_no,x,y,width,height,progress_percent) values(pid,sid,'TEST-20261014-MARK',1,0.1,0.2,0.3,0.4,null);
update public.schemes set page_count=2 where id=sid and row_version=v;
get diagnostics affected = row_count;
if affected<>1 then raise exception 'Versioned update failed'; end if;
update public.schemes set page_count=3 where id=sid and row_version=v;
get diagnostics affected = row_count;
if affected<>0 then raise exception 'Stale version accepted'; end if;
insert into public.milestones(project_id,external_id,title,contract_date,target_qty,target_unit) values(pid,'TEST-20261014-KD','Выполнить 190 свай','2026-10-25',190,'шт.') returning id into mid;
insert into public.numbered_element_groups(project_id,element_type,group_code) values(pid,'Анкер','TEST-20261014-G1') returning id into gid1;
insert into public.numbered_element_groups(project_id,element_type,group_code) values(pid,'Анкер','TEST-20261014-G2') returning id into gid2;
insert into public.numbered_elements(project_id,element_type,element_no,group_id,capture,zone) values(pid,'Анкер','7',gid1,'З1','А'),(pid,'Анкер','7',gid2,'З1','А'),(pid,'Анкер','7',gid1,'З2','А'),(pid,'Анкер','7',gid1,'З1','Б');
begin
insert into public.numbered_elements(project_id,element_type,element_no,group_id,capture,zone) values(pid,'Анкер','7',gid1,'З1','А');
raise exception 'Duplicate unexpectedly accepted';
exception when unique_violation then null;
end;
insert into public.entity_aliases(project_id,entity_type,entity_id,alias) values(pid,'building',bid,'TEST-20261014-ALIAS') on conflict(project_id,entity_type,normalized_alias) do update set entity_id=excluded.entity_id;
insert into public.source_mappings(project_id,source_name,source_entity_type,source_value,target_entity_type,target_entity_id) values(pid,'TEST-20261014','building','Тестовое здание','building',bid) on conflict(project_id,source_name,source_entity_type,normalized_source_value) do update set target_entity_id=excluded.target_entity_id;
end $$;
rollback;
select 'PASS: schemes, nullable progress, row_version, milestones, numbered context, generated upserts; test writes rolled back' as result;
