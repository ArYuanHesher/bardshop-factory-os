-- ============================================================
-- erp_pj_sync：ERP 同步區（PJ/委外/採購/倉庫庫存）統一存放表
-- 倉庫庫存同步後 doc_type = '倉庫庫存'，
--   doc_no          = 料號 (PART)
--   description     = 品名/規格 (PART_DESC)
--   qty             = 庫存數量 (BOH)
--   customer_vendor = 在途數量 (PO_ON_ROAD)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.erp_pj_sync (
  id              bigserial PRIMARY KEY,
  doc_type        text        NOT NULL,           -- '銷售訂單'|'製令單號'|'採購單號'|'委外製令'|'倉庫庫存'
  doc_no          text        NOT NULL,
  sub_no          text        NOT NULL DEFAULT '',
  item_code       text,
  description     text,
  qty             numeric     NOT NULL DEFAULT 0,
  unit            text,
  status          text,
  start_date      text,
  end_date        text,
  customer_vendor text,
  remark          text,
  extra           jsonb,
  synced_at       timestamptz NOT NULL DEFAULT now()
);

-- 索引（大量查詢用）
CREATE INDEX IF NOT EXISTS erp_pj_sync_doc_type_idx ON public.erp_pj_sync (doc_type);
CREATE INDEX IF NOT EXISTS erp_pj_sync_doc_no_idx   ON public.erp_pj_sync (doc_no);

-- RLS：讀寫皆開放（由 supabaseAdmin service_role 寫入，前端 anon 讀取）
ALTER TABLE public.erp_pj_sync ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'erp_pj_sync' AND policyname = 'allow_read'
  ) THEN
    EXECUTE 'CREATE POLICY allow_read ON public.erp_pj_sync FOR SELECT USING (true)';
  END IF;
END $$;
