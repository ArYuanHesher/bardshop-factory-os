-- ============================================================
-- 製令總表新增「批備料狀態」
-- 未備料：剛轉入 ERP 的製令，尚未做批備料
-- 已備料：批備料動作完成（送 ERP 或人工標記）
-- 無需備料：批備料頁面手動標記不需要走批備料
-- ============================================================

ALTER TABLE argoerp_mo_summary
  ADD COLUMN IF NOT EXISTS prep_status TEXT NOT NULL DEFAULT '未備料'
    CHECK (prep_status IN ('未備料', '已備料', '無需備料'));

-- 索引：批備料頁面會以 prep_status 過濾
CREATE INDEX IF NOT EXISTS argoerp_mo_summary_prep_status_idx
  ON argoerp_mo_summary (prep_status, created_at DESC);
