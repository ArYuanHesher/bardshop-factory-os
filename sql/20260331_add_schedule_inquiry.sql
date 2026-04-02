-- 產期詢問/預留單
CREATE TABLE IF NOT EXISTS schedule_inquiries (
  id SERIAL PRIMARY KEY,
  form_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- 填單日期
  customer_name TEXT NOT NULL,              -- 客戶名稱
  order_no TEXT,                            -- 訂單編號（選填）
  product_name TEXT NOT NULL,               -- 品名/規格
  quantity INTEGER,                         -- 數量
  expected_date DATE,                       -- 希望交期(寄出日期)
  handler_name TEXT,                        -- 承辦人
  planned_order_date DATE,                  -- 預計發單日
  remark TEXT,                              -- 備註
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'reserved', 'completed')),  -- 狀態：待處理/已確認/已預留/已完成
  author_name TEXT NOT NULL,                -- 建立人
  author_email TEXT,                        -- 建立人 email
  department TEXT,                          -- 部門
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE schedule_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to schedule_inquiries"
  ON schedule_inquiries FOR ALL
  USING (true)
  WITH CHECK (true);
