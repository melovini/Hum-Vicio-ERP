-- ====================================================================
-- HUM VÍCIO ERP: CONTROLE DE RETIRADA NO BALCÃO (ENTREGA AO CLIENTE)
-- Data: 18/09/2026
-- ====================================================================

BEGIN;

-- 1. Garante a existência das colunas delivered_at e delivered_by em public.sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS delivered_by TEXT;

-- 2. Cria índice para consultas rápidas de pedidos de balcão pendentes de retirada
CREATE INDEX IF NOT EXISTS idx_sales_pickup_pending
  ON public.sales (created_at DESC)
  WHERE order_type = 'retirada' AND production_status = 'concluido' AND delivered_at IS NULL;

COMMIT;
