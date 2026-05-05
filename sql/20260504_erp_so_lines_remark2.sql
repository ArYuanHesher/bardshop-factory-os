-- 新增 remark2 欄位到 erp_so_lines
-- 對應 PJ_PROJECTDETAIL.REMARK2（出貨備註）
-- 同步時一併補上 REMARK（品名/規格）與 PACKING（包裝說明）的實際資料

alter table public.erp_so_lines
  add column if not exists remark2 text;  -- 出貨備註 (REMARK2)

comment on column public.erp_so_lines.remark2 is
  'ArgoERP PJ_PROJECTDETAIL.REMARK2，出貨備註';
