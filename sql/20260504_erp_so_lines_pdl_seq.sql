-- 新增 pdl_seq 欄位到 erp_so_lines
-- PDL_SEQ = PJ_PROJECTDETAIL 的唯一序號，用於比對採購單的 PDL_SEQ_SO

alter table public.erp_so_lines
  add column if not exists pdl_seq bigint;  -- SO 明細唯一序號 (PDL_SEQ)

comment on column public.erp_so_lines.pdl_seq is
  'ArgoERP PJ_PROJECTDETAIL.PDL_SEQ，用於與 PO 的 PDL_SEQ_SO 做比對';

create index if not exists erp_so_lines_pdl_seq_idx on public.erp_so_lines (pdl_seq);
