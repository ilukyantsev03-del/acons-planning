-- Final accepted facade edition starts a new comparison history.
-- Dates/tasks/base values and the audit journal are unchanged.
update public.gpr_items set data=jsonb_set(data,'{historyStart}','"2026-11-20"'::jsonb)
where schedule_id='facade-main' and kind='meta' and id='baseline';
