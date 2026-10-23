-- A bounded timeout for a single atomic snapshot write, with existing RLS intact.
create or replace function public.save_construction_snapshot(
 p_project_id uuid, p_document jsonb, p_expected_revision bigint
) returns table(revision bigint)
language plpgsql security invoker
set search_path = ''
set statement_timeout = '30s'
as $$
begin
 if auth.uid() is null then
  raise sqlstate '42501' using message='Authentication required';
 end if;
 if p_expected_revision is null or p_expected_revision < 0 then
  raise exception 'Invalid expected revision';
 end if;
 if jsonb_typeof(p_document) is distinct from 'object' then
  raise exception 'Invalid project document';
 end if;
 if not exists(select 1 from public.projects p where p.id=p_project_id
   and p.external_id=p_document->'meta'->>'constructionId') then
  raise sqlstate '42501' using message='Project identity or access mismatch';
 end if;
 if p_expected_revision=0 then
  return query insert into public.construction_project_snapshots as s
   (project_id,project,revision,updated_by)
   values(p_project_id,p_document,1,auth.uid())
   on conflict(project_id) do nothing returning s.revision;
 else
  return query update public.construction_project_snapshots as s
   set project=p_document,revision=p_expected_revision+1,updated_by=auth.uid()
   where s.project_id=p_project_id and s.revision=p_expected_revision
   returning s.revision;
 end if;
 if not found then
  raise sqlstate 'PT409' using message='Snapshot revision conflict';
 end if;
end;
$$;
revoke all on function public.save_construction_snapshot(uuid,jsonb,bigint) from public,anon;
grant execute on function public.save_construction_snapshot(uuid,jsonb,bigint) to authenticated;
notify pgrst, 'reload schema';
