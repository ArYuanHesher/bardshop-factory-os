-- ============================================================
-- 2026-05-05  製令機台欄位 + 機台選單表
-- ============================================================

-- 1. 在製令總表新增 machine 欄位（印刷機台）
ALTER TABLE public.argoerp_mo_summary
  ADD COLUMN IF NOT EXISTS machine text;

COMMENT ON COLUMN public.argoerp_mo_summary.machine
  IS '印刷機台，對應列印工單右上角印刷機台欄位';

-- 3. 在製令總表新增 plate_count 欄位（盤數，來自上傳原始資料）
ALTER TABLE public.argoerp_mo_summary
  ADD COLUMN IF NOT EXISTS plate_count text;

COMMENT ON COLUMN public.argoerp_mo_summary.plate_count
  IS '盤數，來自工單批量上傳原始資料，供批備料計算需求量使用';

-- 2. 獨立的機台選單表（供新增/編輯/刪除機台名稱）
CREATE TABLE IF NOT EXISTS public.mo_machines (
  id          serial      PRIMARY KEY,
  name        text        NOT NULL UNIQUE,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.mo_machines        IS '製令印刷機台選單';
COMMENT ON COLUMN public.mo_machines.name   IS '機台名稱，顯示於製令總表下拉選單及工單右上角';
