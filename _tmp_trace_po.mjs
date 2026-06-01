import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envText = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=')).map(l => {
  const idx = l.indexOf('=')
  return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
}))

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE)

// Trace ALL sheet dates for SO260522008 O factory rows
const { data: allSheets } = await sb.from('daily_order_sheets')
  .select('sheet_date, rows').order('sheet_date', { ascending: true })

for (const sheet of allSheets) {
  const rows = (sheet.rows || []).filter(r => r.order_number === 'SO260522008' && r.factory === 'O')
  if (rows.length > 0) {
    console.log('\nDate:', sheet.sheet_date)
    rows.forEach((r, i) => {
      console.log(`  row ${i+1} | qty: ${r.quantity} | item_name: ${r.item_name} | po_number: ${r.po_number} | po_status: ${r.po_status} | match_line_no: ${r.match_line_no}`)
    })
  }
}

// Check erp_pj_sync synced data for this PO
console.log('\n--- erp_pj_sync for POO2605220080x ---')
const { data: pjRows } = await sb.from('erp_pj_sync')
  .select('doc_no, sub_no, item_code, qty, status, synced_at')
  .like('doc_no', 'POO2605220080%')
  .order('synced_at', { ascending: true })
console.log(JSON.stringify(pjRows, null, 2))

process.exit(0)
