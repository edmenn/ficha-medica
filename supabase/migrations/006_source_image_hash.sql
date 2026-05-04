alter table public.surgical_records
  add column if not exists source_image_hash text;

create index if not exists idx_surgical_records_user_source_image_hash
  on public.surgical_records (user_id, source_image_hash)
  where source_image_hash is not null;
