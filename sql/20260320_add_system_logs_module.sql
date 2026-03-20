-- 為 system_logs 新增 module 欄位，用於記錄操作所屬的首頁模組分類
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS module TEXT DEFAULT NULL;

-- 更新既有的歷史資料（根據 target_resource 前綴推斷模組）
UPDATE system_logs SET module = '系統設定' WHERE module IS NULL AND (
  target_resource ILIKE 'member:%'
  OR target_resource ILIKE 'department:%'
  OR target_resource ILIKE 'announcement:%'
  OR target_resource ILIKE 'machine:%'
  OR target_resource ILIKE 'calendar:%'
  OR target_resource ILIKE 'members:%'
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_system_logs_module ON system_logs (module);
