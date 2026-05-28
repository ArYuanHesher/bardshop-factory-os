// 用 Supabase Management API 執行 ALTER TABLE
// ref: https://api.supabase.com/v1/projects/{ref}/database/query
// 需要 Supabase Access Token (PAT)，不是 service role key

const PROJECT_REF = 'jsybeaebvvzpgrnxwums'
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWJlYWVidnZ6cGdybnh3dW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA5NzMyNSwiZXhwIjoyMDg1NjczMzI1fQ.OlrwRFeKufEdzfrNWwaCU1qrSM_c8VPKPhJNXi31jJ4'

const sql = `
ALTER TABLE public.mm_bom_part_units
  ADD COLUMN IF NOT EXISTS part_name text,
  ADD COLUMN IF NOT EXISTS part_desc text;
COMMENT ON COLUMN public.mm_bom_part_units.part_name IS 'ARGO MM_BOM_PART.PART_NAME（料號中文名稱）';
COMMENT ON COLUMN public.mm_bom_part_units.part_desc IS 'ARGO MM_BOM_PART.PART_DESC（規格描述，如顏色/尺寸）';
`.trim()

// 方法 A：Management API（需要 PAT）
const resA = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE}`,
  },
  body: JSON.stringify({ query: sql }),
})
const textA = await resA.text()
console.log(`[Management API] HTTP ${resA.status}:`, textA.slice(0, 300))

// 方法 B：pg-meta（Supabase 內部用，有時可透過 service role 存取）
const resB = await fetch(`https://${PROJECT_REF}.supabase.co/pg/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE}`,
    'apikey': SERVICE_ROLE,
  },
  body: JSON.stringify({ query: sql }),
})
const textB = await resB.text()
console.log(`[pg-meta] HTTP ${resB.status}:`, textB.slice(0, 300))
