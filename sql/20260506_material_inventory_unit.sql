-- ============================================================
-- 2026-05-06  material_inventory_list 新增 unit_of_measure 欄位
-- ============================================================
ALTER TABLE public.material_inventory_list
  ADD COLUMN IF NOT EXISTS unit_of_measure text;

COMMENT ON COLUMN public.material_inventory_list.unit_of_measure
  IS '料件單位，從 ARGO 物料主檔同步（供批備料送 ARGO 時使用）';
