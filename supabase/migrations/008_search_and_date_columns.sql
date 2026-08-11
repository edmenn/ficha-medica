-- 008_search_and_date_columns.sql
-- Adds a real date column for reliable DB-side filtering/ordering of the
-- surgical date (currently stored only as a dd-mm-yyyy string inside JSONB).
-- Also adds indexes for common filters.

-- 1) Materialize the surgical date as a real date.
ALTER TABLE public.surgical_records
  ADD COLUMN IF NOT EXISTS surgical_date date;

-- Backfill from existing final_data->>'fecha_cirugia' (dd-mm-yyyy or yyyy-mm-dd).
DO $$
DECLARE
  r RECORD;
  parts TEXT[];
  parsed DATE;
BEGIN
  FOR r IN
    SELECT id, final_data->>'fecha_cirugia' AS raw_date
    FROM public.surgical_records
    WHERE surgical_date IS NULL
  LOOP
    IF r.raw_date IS NULL OR r.raw_date = '' THEN
      CONTINUE;
    END IF;
    parts := string_to_array(trim(r.raw_date), '-');
    IF array_length(parts, 1) = 3 THEN
      IF length(parts[1]) = 4 THEN
        -- yyyy-mm-dd
        parsed := to_date(parts[1] || '-' || parts[2] || '-' || parts[3], 'YYYY-MM-DD');
      ELSIF length(parts[3]) = 4 THEN
        -- dd-mm-yyyy
        parsed := to_date(parts[3] || '-' || parts[2] || '-' || parts[1], 'YYYY-MM-DD');
      ELSE
        CONTINUE;
      END IF;
      IF parsed IS NOT NULL THEN
        UPDATE public.surgical_records SET surgical_date = parsed WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- 2) Indexes for common filters.
CREATE INDEX IF NOT EXISTS idx_surgical_records_user_date
  ON public.surgical_records (user_id, surgical_date DESC);
CREATE INDEX IF NOT EXISTS idx_surgical_records_user_status
  ON public.surgical_records (user_id, status);
CREATE INDEX IF NOT EXISTS idx_surgical_records_user_created
  ON public.surgical_records (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_surgical_records_user_paciente
  ON public.surgical_records (user_id, (final_data->>'paciente'));
CREATE INDEX IF NOT EXISTS idx_surgical_records_user_cirujano
  ON public.surgical_records (user_id, (final_data->>'cirujano'));
CREATE INDEX IF NOT EXISTS idx_surgical_records_user_sanatorio
  ON public.surgical_records (user_id, (final_data->>'sanatorio'));

-- 3) Trigger to keep surgical_date in sync on insert/update.
CREATE OR REPLACE FUNCTION public.sync_surgical_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  raw TEXT;
  parts TEXT[];
BEGIN
  raw := coalesce(new.final_data->>'fecha_cirugia', '');
  new.surgical_date := NULL;
  IF raw <> '' THEN
    parts := string_to_array(trim(raw), '-');
    IF array_length(parts, 1) = 3 THEN
      IF length(parts[1]) = 4 THEN
        BEGIN
          new.surgical_date := to_date(parts[1] || '-' || parts[2] || '-' || parts[3], 'YYYY-MM-DD');
        EXCEPTION WHEN others THEN new.surgical_date := NULL;
        END;
      ELSIF length(parts[3]) = 4 THEN
        BEGIN
          new.surgical_date := to_date(parts[3] || '-' || parts[2] || '-' || parts[1], 'YYYY-MM-DD');
        EXCEPTION WHEN others THEN new.surgical_date := NULL;
        END;
      END IF;
    END IF;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_surgical_date ON public.surgical_records;
CREATE TRIGGER trg_sync_surgical_date
  BEFORE INSERT OR UPDATE OF final_data ON public.surgical_records
  FOR EACH ROW EXECUTE FUNCTION public.sync_surgical_date();
