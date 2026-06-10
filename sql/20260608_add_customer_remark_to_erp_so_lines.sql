-- 2026-06-08
-- Add order-level customer remark from PJ_PROJECT header to erp_so_lines

ALTER TABLE public.erp_so_lines
  ADD COLUMN IF NOT EXISTS customer_remark text;

COMMENT ON COLUMN public.erp_so_lines.customer_remark IS '訂單備註（PJ_PROJECT.CUSTOMER_REMARK）';
