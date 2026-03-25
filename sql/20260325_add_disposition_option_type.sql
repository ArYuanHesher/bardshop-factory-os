-- ============================================================
-- 缺失處置 (disposition) 選項類型
-- 執行日期：2026-03-25
-- 說明：
--   qa_anomaly_option_items.option_type 為 text 欄位，
--   新增 'disposition' 類型不需要 ALTER TABLE。
--   若資料庫有 CHECK constraint 限制 option_type，
--   請執行下方 Step 1 移除限制後再新增選項。
-- ============================================================

-- Step 1：移除 option_type 的 CHECK constraint
ALTER TABLE qa_anomaly_option_items
  DROP CONSTRAINT qa_anomaly_option_items_option_type_check;

-- Step 2：新增初始缺失處置選項（可依需求增減）
INSERT INTO qa_anomaly_option_items (option_type, option_value)
VALUES
  ('disposition', '重工'),
  ('disposition', '報廢'),
  ('disposition', '讓步接收'),
  ('disposition', '退貨'),
  ('disposition', '隔離'),
  ('disposition', '待判定')
ON CONFLICT DO NOTHING;
