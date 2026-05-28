import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jsybeaebvvzpgrnxwums.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWJlYWVidnZ6cGdybnh3dW1zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA5NzMyNSwiZXhwIjoyMDg1NjczMzI1fQ.OlrwRFeKufEdzfrNWwaCU1qrSM_c8VPKPhJNXi31jJ4'
)

// 1. 確認欄位存在
const { data, error } = await supabase
  .from('mm_bom_part_units')
  .select('part_code, unit_of_measure, part_name, part_desc')
  .limit(3)

if (error) {
  console.error('❌ 欄位確認失敗:', error.message)
  process.exit(1)
}

console.log('✅ 欄位確認成功，現有欄位: part_code, unit_of_measure, part_name, part_desc')
console.log('目前 part_name 狀態（前3筆）:')
data.forEach(r => console.log(`  ${r.part_code}: part_name=${r.part_name ?? '(null)'}  part_desc=${r.part_desc ?? '(null)'}  unit=${r.unit_of_measure}`))
