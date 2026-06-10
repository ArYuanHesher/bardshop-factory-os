-- 2026-06-08
-- Add export mode (invoice mode) from PJ_PROJECT header to erp_so_lines

ALTER TABLE public.erp_so_lines
  ADD COLUMN IF NOT EXISTS invoice_format text;

COMMENT ON COLUMN public.erp_so_lines.invoice_format IS '發票型態（PJ_PROJECT.EXPORT_MODE；若無則用 INVOICE_FORMAT）';
