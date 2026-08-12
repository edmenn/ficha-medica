-- 010_ai_usage_preserve_history.sql
-- Al borrar un registro no debe desaparecer el historico de uso de IA del total
-- global de Configuracion. Cambia la FK record_id de ON DELETE CASCADE a
-- ON DELETE SET NULL (record_id queda NULL; el gasto historico persiste).

alter table public.ai_usage
  drop constraint ai_usage_record_id_fkey;

alter table public.ai_usage
  add constraint ai_usage_record_id_fkey
  foreign key (record_id) references public.surgical_records(id)
  on delete set null;
