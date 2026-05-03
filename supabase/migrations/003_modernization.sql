alter table public.surgical_records
  add column if not exists image_paths text[] not null default '{}';

update public.surgical_records
set image_paths = array[image_path]
where image_path is not null
  and (image_paths is null or array_length(image_paths, 1) is null);

drop table if exists public.record_fields;
