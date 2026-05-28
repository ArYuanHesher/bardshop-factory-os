import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jsybeaebvvzpgrnxwums.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWJlYWVidnZ6cGdybnh3dW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA5NzMyNSwiZXhwIjoyMDg1NjczMzI1fQ.OlrwRFeKufEdzfrNWwaCU1qrSM_c8VPKPhJNXi31jJ4'
)

const sql = `
ALTER TABLE public.mm_bom_part_units
  ADD COLUMN IF NOT EXISTS part_name text,
  ADD COLUMN IF NOT EXISTS part_desc text;

COMMENT ON COLUMN public.mm_bom_part_units.part_name
  IS 'ARGO MM_BOM_PART.PART_NAME（料號中文名稱）';
COMMENT ON COLUMN public.mm_bom_part_units.part_desc
  IS 'ARGO MM_BOM_PART.PART_DESC（規格描述，如顏色/尺寸）';
`

const { error } = await supabase.rpc('exec_sql', { sql_text: sql }).catch(() => ({ error: 'rpc not available' }))

if (error && String(error).includes('rpc not available')) {
  // 改用 REST /sql 端點（Supabase >= 2.x）
  const res = await fetch('https://jsybeaebvvzpgrnxwums.supabase.co/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWJlYWVidnZ6cGdybnh3dW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA5NzMyNSwiZXhwIjoyMDg1NjczMzI1fQ.OlrwRFeKufEdzfrNWwaCU1qrSM_c8VPKPhJNXi31jJ4',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWJlYWVidnZ6cGdybnh3dW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA5NzMyNSwiZXhwIjoyMDg1NjczMzI1fQ.OlrwRFeKufEdzfrNWwaCU1qrSM_c8VPKPhJNXi31jJ4',
    },
    body: JSON.stringify({ sql_text: sql }),
  })
  console.log('HTTP Status:', res.status)
  console.log(await res.text())
} else if (error) {
  console.error('Error:', error)
} else {
  console.log('✅ Migration applied successfully')
}
