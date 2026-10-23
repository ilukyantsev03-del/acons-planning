-- Register only the signed-in planner/admin who creates their own new project.
-- No global roles, existing membership decisions or RLS policies are changed.
create or replace function private.register_planning_project_creator()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if auth.uid() is not null and new.created_by=auth.uid()
    and new.external_id ~ '^LIV-P-[0-9a-f-]{36}$'
    and private.current_app_role() in ('admin','planner') then
  insert into public.project_members(project_id,user_id,can_read,can_write,can_admin)
   values(new.id,auth.uid(),true,false,false)
   on conflict(project_id,user_id) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function private.register_planning_project_creator() from public,anon,authenticated;
create trigger register_planning_project_creator after insert on public.projects
 for each row execute function private.register_planning_project_creator();

-- Repair only the reported project; never alter existing membership decisions.
insert into public.project_members(project_id,user_id,can_read,can_write,can_admin)
 select p.id,p.created_by,true,false,false
 from public.projects p join public.app_users u on u.id=p.created_by
 where p.external_id='LIV-P-44bc178d-fe9f-47f4-84c7-6f59b3b1147f' and p.status='active'
   and u.active=true and u.role in ('admin','planner')
 on conflict(project_id,user_id) do nothing;
