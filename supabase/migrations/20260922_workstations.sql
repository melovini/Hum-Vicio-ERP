-- Execute após 20260921_kitchen_components_safe_upgrade.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS public.workstations (
  id text PRIMARY KEY CHECK (length(trim(id)) BETWEEN 1 AND 60 AND id !~ '[[:cntrl:]]')
);
CREATE UNIQUE INDEX IF NOT EXISTS workstations_name_unique ON public.workstations (lower(trim(id)));
INSERT INTO public.workstations (id) VALUES ('none'), ('grill'), ('fryer'), ('oven'), ('cold'), ('assembly'), ('other') ON CONFLICT DO NOTHING;
INSERT INTO public.workstations (id) SELECT DISTINCT station FROM public.kitchen_components ON CONFLICT DO NOTHING;
ALTER TABLE public.kitchen_components DROP CONSTRAINT IF EXISTS kitchen_components_station_check;
ALTER TABLE public.kitchen_components DROP CONSTRAINT IF EXISTS kitchen_components_station_fkey;
ALTER TABLE public.kitchen_components ADD CONSTRAINT kitchen_components_station_fkey FOREIGN KEY (station) REFERENCES public.workstations(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
INSERT INTO public.kitchen_components (id, name, component_type, station, production_unit, show_in_summary) VALUES ('cmp-no-prep', 'Sem preparo individual', 'other', 'none', 'unidade', false) ON CONFLICT DO NOTHING;
ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workstations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workstations TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
