-- ============================================================
-- 2026-05-06  新增 mm_bom_part_units — 料號 ↔ ARGO 庫存單位對照表
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mm_bom_part_units (
  part_code       text PRIMARY KEY,
  unit_of_measure text,
  synced_at       timestamptz DEFAULT now()
);

COMMENT ON TABLE public.mm_bom_part_units
  IS '料號與庫存單位對照（從 ARGO MM_BOM_PART 全量同步），供批備料送 ARGO 時自動帶入正確單位';
COMMENT ON COLUMN public.mm_bom_part_units.part_code
  IS 'ARGO MM_BOM_PART.PART';
COMMENT ON COLUMN public.mm_bom_part_units.unit_of_measure
  IS 'ARGO MM_BOM_PART.UNIT_OF_MEASURE（庫存單位，例如 張、片、個）';

-- RLS：允許已認證及匿名使用者讀取（此為唯讀參考資料）
ALTER TABLE public.mm_bom_part_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_mm_bom_part_units"
  ON public.mm_bom_part_units
  FOR SELECT
  USING (true);
