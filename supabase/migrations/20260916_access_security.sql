-- Aplicar em janela de manutenção, junto da nova versão e de security:setup.
-- O navegador deixa de acessar PostgREST/Realtime diretamente. Somente o servidor
-- usa service_role, com autorização por operação na API do aplicativo.
BEGIN;

ALTER TABLE public.collaborators ALTER COLUMN pin TYPE text;
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS pay_type text DEFAULT 'mensalista';
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS daily_rate numeric;
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS weekly_schedule jsonb DEFAULT '[]';
ALTER TABLE public.collaborators ALTER COLUMN weekly_schedule DROP DEFAULT;
ALTER TABLE public.collaborators ALTER COLUMN weekly_schedule TYPE jsonb USING weekly_schedule::jsonb;
ALTER TABLE public.collaborators ALTER COLUMN weekly_schedule SET DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS public.collaborator_diarias (
  id varchar(100) PRIMARY KEY, collaborator_id varchar(100) NOT NULL,
  collaborator_name varchar(150) NOT NULL, date date NOT NULL,
  type varchar(30) NOT NULL CHECK (type IN ('diaria', 'diaria_extra', 'agrado', 'pagamento_acerto')),
  amount numeric(10,2) NOT NULL, notes text, payment_method varchar(50),
  registered_by varchar(100), created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id uuid PRIMARY KEY,
  collaborator_id varchar(100) NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  collaborator_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS app_sessions_collaborator ON public.app_sessions(collaborator_id);
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  key text PRIMARY KEY, attempts integer NOT NULL, window_started timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION public.consume_auth_attempt(bucket_key text, attempt_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE hits integer;
BEGIN
  INSERT INTO public.auth_attempts AS a(key, attempts, window_started)
  VALUES (bucket_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    attempts = CASE WHEN a.window_started < now() - interval '15 minutes' THEN 1 ELSE a.attempts + 1 END,
    window_started = CASE WHEN a.window_started < now() - interval '15 minutes' THEN now() ELSE a.window_started END
  RETURNING attempts INTO hits;
  DELETE FROM public.auth_attempts WHERE window_started < now() - interval '1 day';
  RETURN hits <= attempt_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_customers_secure(incoming jsonb, replace_existing boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(incoming) <> 'array' OR jsonb_array_length(incoming) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Invalid customer batch';
  END IF;
  PERFORM pg_advisory_xact_lock(20260916, 2);
  IF replace_existing THEN DELETE FROM public.imported_customers; END IF;
  INSERT INTO public.imported_customers
    (id, name, phone, address, number, neighborhood, city, complement, full_address,
     total_orders, last_order_date, source, imported_at)
  SELECT x->>'id', x->>'name', x->>'phone', x->>'address', x->>'number', x->>'neighborhood',
    x->>'city', x->>'complement', x->>'fullAddress', (x->>'totalOrders')::integer,
    x->>'lastOrderDate', coalesce(nullif(x->>'source', ''), 'cardapio_web'), (x->>'importedAt')::timestamptz
  FROM jsonb_array_elements(incoming) x
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone,
    address = EXCLUDED.address, number = EXCLUDED.number, neighborhood = EXCLUDED.neighborhood,
    city = EXCLUDED.city, complement = EXCLUDED.complement, full_address = EXCLUDED.full_address,
    total_orders = EXCLUDED.total_orders, last_order_date = EXCLUDED.last_order_date,
    source = EXCLUDED.source, imported_at = EXCLUDED.imported_at, updated_at = now();
END;
$$;

-- Não permitir que a administração elimine o último acesso administrativo.
CREATE OR REPLACE FUNCTION public.protect_last_administrator()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(20260916, 1);
  IF OLD.role = 'admin' AND OLD.is_active AND
     (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NOT NEW.is_active) AND
     NOT EXISTS (SELECT 1 FROM public.collaborators WHERE role = 'admin' AND is_active AND id <> OLD.id) THEN
    RAISE EXCEPTION 'Preserve at least one active administrator';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_last_administrator ON public.collaborators;
CREATE TRIGGER protect_last_administrator BEFORE UPDATE OR DELETE ON public.collaborators
FOR EACH ROW EXECUTE FUNCTION public.protect_last_administrator();

-- Revogar também privilégios em views e funções antigas que poderiam contornar
-- as tabelas protegidas. O schema public deste projeto é exclusivo do ERP.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', item.tablename);
  END LOOP;
  FOR item IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', item.policyname, item.tablename);
  END LOOP;
END;
$$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;
COMMIT;
