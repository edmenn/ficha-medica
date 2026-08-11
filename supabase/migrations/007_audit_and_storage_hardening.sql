-- 007_audit_and_storage_hardening.sql
-- Idempotent. Extends audit_action enum, adds audit metadata columns,
-- and creates Storage policies for the surgical-images bucket.

-- 1) Extend audit_action with the events required for full clinical traceability.
DO $$
BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'deleted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'reanalyzed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Store the effective (impersonated) user on audit entries so we know both
--    the real actor and whom the action affected.
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS effective_user_id uuid REFERENCES public.users(id);
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}';

-- Index for admin audit queries by actor, record and time range.
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON public.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_created
  ON public.audit_log (record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_effective_user
  ON public.audit_log (effective_user_id, created_at DESC);

-- 3) Storage policies for the surgical-images bucket.
--    RLS on Storage buckets is controlled per-bucket via storage.objects.
--    These policies scope access to the owning user prefix (<user_id>/...).
--    The app also validates ownership server-side (lib/storage-paths.ts).

DO $$
BEGIN
  -- Insert: any authenticated user may upload objects under their own prefix.
  EXECUTE format(
    'create policy "surgical_images_insert_own" on storage.objects
       for insert to authenticated
       with check (
         bucket_id = ''surgical-images''
         and (storage.foldername(name))[1] = auth.uid()::text
       )'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- Select: authenticated user may read their own objects.
  EXECUTE format(
    'create policy "surgical_images_select_own" on storage.objects
       for select to authenticated
       using (
         bucket_id = ''surgical-images''
         and (storage.foldername(name))[1] = auth.uid()::text
       )'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- Update: authenticated user may update their own objects.
  EXECUTE format(
    'create policy "surgical_images_update_own" on storage.objects
       for update to authenticated
       using (
         bucket_id = ''surgical-images''
         and (storage.foldername(name))[1] = auth.uid()::text
       )
       with check (
         bucket_id = ''surgical-images''
         and (storage.foldername(name))[1] = auth.uid()::text
       )'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- Delete: authenticated user may delete their own objects.
  EXECUTE format(
    'create policy "surgical_images_delete_own" on storage.objects
       for delete to authenticated
       using (
         bucket_id = ''surgical-images''
         and (storage.foldername(name))[1] = auth.uid()::text
       )'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
