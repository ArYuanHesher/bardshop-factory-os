-- ============================================================
-- ArgoERP 製令總表（MO Summary）
-- 取代原本只存 localStorage 的做法 → 永久保存 + 跨裝置同步 + DB 層擋重複單號
-- ============================================================

CREATE TABLE IF NOT EXISTS argoerp_mo_summary (
  -- 製令單號：MO + 廠別(T/C/O) + 開立日期(YYYYMMDD) + 三碼流水號 → 11~12 chars
  -- 設為 PRIMARY KEY = 同時兼具唯一性檢查（這就是「不要有重複」的最後防線）
  mo_number            TEXT PRIMARY KEY,

  -- 廠別: T=台北 / C=常平 / O=委外
  factory              TEXT NOT NULL CHECK (factory IN ('T', 'C', 'O')),

  -- 製令內容欄位（與前端 MoRecord 介面對齊）
  planned_start_date   TEXT,            -- 預定投產日（YYYY/MM/DD 文字格式，沿用前端格式）
  planned_end_date     TEXT,            -- 預定結案日
  mo_status            TEXT,            -- 製令狀態（OPEN/HOLD…）
  department           TEXT,            -- 部門代碼
  product_code         TEXT,            -- 生產貨號
  lot_number           TEXT,            -- 批號（客戶名稱）
  planned_qty          TEXT,            -- 預訂產出量
  source_order         TEXT,            -- 來源訂單
  mo_note              TEXT,            -- 製令說明
  create_date          TEXT,            -- 開立日期（業務語意，非 row 建立時間）

  -- 稽核欄位
  saved_at             TEXT,            -- 前端儲存時的本地時間字串（顯示用）
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 流水號查詢加速：（factory, create_date）通常是 WHERE 條件
CREATE INDEX IF NOT EXISTS argoerp_mo_summary_factory_date_idx
  ON argoerp_mo_summary (factory, create_date);

-- 依儲存時間倒序列表
CREATE INDEX IF NOT EXISTS argoerp_mo_summary_created_at_idx
  ON argoerp_mo_summary (created_at DESC);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION argoerp_mo_summary_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS argoerp_mo_summary_updated_at_trg ON argoerp_mo_summary;
CREATE TRIGGER argoerp_mo_summary_updated_at_trg
  BEFORE UPDATE ON argoerp_mo_summary
  FOR EACH ROW
  EXECUTE FUNCTION argoerp_mo_summary_set_updated_at();

-- ============================================================
-- RLS：本表只透過後端 API（service role）存取，
-- 拒絕 anon / authenticated 直接讀寫 → 不暴露 ERP 資料給瀏覽器層
-- ============================================================
ALTER TABLE argoerp_mo_summary ENABLE ROW LEVEL SECURITY;

-- 預設不建立任何 policy → anon/authenticated 完全無法 SELECT/INSERT/UPDATE/DELETE
-- service_role key 會 bypass RLS，所以 /api/argoerp/mo-summary 仍可存取
