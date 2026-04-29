-- 更新 erp_so_lines：將原本只有表頭的欄位補上 PJ_PROJECTDETAIL 明細欄位
-- 對應工程師提供的 JOIN 查詢格式 (PJ_PROJECT + PJ_PROJECTDETAIL)
-- 執行時間：2026-04-27

-- 新增明細欄位（若已存在則略過）
alter table public.erp_so_lines
  add column if not exists sales_id          integer,        -- 業務員編號  (SALES_ID)
  add column if not exists currency          text,           -- 幣別        (CURRENCY)
  add column if not exists exchange_rate     numeric,        -- 匯率        (EXCHANGE_RATE)
  add column if not exists department        text,           -- 部門        (SEG_SEGMENT_NO_DEPARTMENT)
  add column if not exists sales_category    text,           -- 銷售類別    (SALES_CATEGORY)
  add column if not exists hold_status       text,           -- 狀態        (HOLD_STATUS)
  add column if not exists mbp_part          text,           -- 料號        (MBP_PART)
  add column if not exists mbp_ver           integer,        -- 版本        (MBP_VER)
  add column if not exists duedate           text,           -- 交貨日(預)  (DUEDATE)
  add column if not exists packing           text,           -- 包裝說明    (PACKING)
  add column if not exists order_qty_oru     numeric default 0, -- 數量     (ORDER_QTY_ORU)
  add column if not exists unit_of_measure_oru text,         -- 單位        (UNIT_OF_MEASURE_ORU)
  add column if not exists unit_price_oru    numeric default 0, -- 單價     (UNIT_PRICE_ORU)
  add column if not exists grade             text,           -- 等級        (GRADE)
  add column if not exists partner_name      text,           -- 客戶名稱    (PARTNER_NAME)
  add column if not exists remark            text,           -- 備註        (REMARK)
  add column if not exists create_date       text,           -- 建立日期    (CREATE_DATE)
  add column if not exists update_date       text;           -- 更新日期    (UPDATE_DATE)

-- 補充索引
create index if not exists erp_so_lines_mbp_part_idx     on public.erp_so_lines (mbp_part);
create index if not exists erp_so_lines_hold_status_idx  on public.erp_so_lines (hold_status);
create index if not exists erp_so_lines_duedate_idx      on public.erp_so_lines (duedate);
