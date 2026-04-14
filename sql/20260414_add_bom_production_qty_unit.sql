-- 新增 BOM 表的生產數量與生產單位欄位
ALTER TABLE bom ADD COLUMN IF NOT EXISTS production_quantity numeric DEFAULT 1;
ALTER TABLE bom ADD COLUMN IF NOT EXISTS production_unit text DEFAULT '';
