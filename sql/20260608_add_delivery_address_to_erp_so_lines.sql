-- 2026-06-08
-- Add delivery address from PJ_PROJECT header to erp_so_lines

ALTER TABLE public.erp_so_lines
  ADD COLUMN IF NOT EXISTS delivery_address text;

COMMENT ON COLUMN public.erp_so_lines.delivery_address IS '交貨地址（PJ_PROJECT.DELIVERY_ADDRESS）';
