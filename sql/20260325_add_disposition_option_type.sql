-- ============================================================
-- 缺失處置 (disposition) 選項類型
-- 執行日期：2026-03-25
-- 說明：
--   qa_anomaly_option_items.option_type 為 text 欄位，
--   新增 'disposition' 類型不需要 ALTER TABLE。
--   若資料庫有 CHECK constraint 限制 option_type，
--   請執行下方 Step 1 移除限制後再新增選項。
-- ============================================================

-- Step 1（若有 CHECK constraint 才需執行）
-- 查詢是否存在限制：
-- SELECT conname FROM pg_constraint WHERE conrelid = 'qa_anomaly_option_items'::regclass AND contype = 'c';
--
-- 若存在，請將 <constraint_name> 替換為實際名稱後執行：
-- ALTER TABLE qa_anomaly_option_items
--   DROP CONSTRAINT <constraint_name>;

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
