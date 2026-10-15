-- Настройка существующего приватного bucket, применена 15.10.2026.
-- Доступ и лимит размера не меняются.
update storage.buckets set allowed_mime_types = array['application/pdf','image/png','image/jpeg'] where id = 'liv-schemes';
