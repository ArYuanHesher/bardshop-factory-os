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

for (const sheet of sheets) {
  const rows = (sheet.rows || []).filter(r => r.order_number === 'SO260522008' && r.factory === 'O')
  if (rows.length > 0) {
    console.log('\nDate:', sheet.sheet_date)
    rows.forEach((r, i) => {
      console.log(`  row ${i+1} | qty: ${r.quantity} | item_name: ${r.item_name} | po_number: ${r.po_number} | po_status: ${r.po_status} | match_line_no: ${r.match_line_no}`)
    })
  }
}

// Also check argoerp_mo_upload_log or any import log for this PO
console.log('\n--- erp_pj_sync history for POO2605220080x ---')
const { data: pjRows } = await sb.from('erp_pj_sync')
  .select('doc_no, sub_no, item_code, qty, status, synced_at')
  .like('doc_no', 'POO2605220080%')
  .order('synced_at', { ascending: true })
console.log(JSON.stringify(pjRows, null, 2))

process.exit(0)

// Check latest sheet date that has C3CMOUB-2024 O factory row
const { data: sheets, error: se } = await sb.from('daily_order_sheets')
  .select('sheet_date, rows')
  .order('sheet_date', { ascending: false })
  .limit(10)

if (se) { console.error(se); process.exit(1) }

for (const sheet of sheets) {
  const rows = sheet.rows || []
  // Find rows where order_number contains "S" + something + "260522008"
  const matches = rows.filter(r => r.factory === 'O' && r.item_code === 'C3CMOUB-2024')
  if (matches.length > 0) {
    console.log('Sheet date:', sheet.sheet_date)
    for (const r of matches) {
      console.log('Row order_number:', r.order_number, '| match_status:', r.match_status, '| po_number:', r.po_number)
      console.log('order_number chars:', [...(r.order_number||'')].map(c => c + '(' + c.charCodeAt(0) + ')').join(' '))
    }
  }
}

// Also search all sheets for any row with order containing "260522008"
console.log('\n--- Searching all sheets for order_number containing 260522008 ---')
for (const sheet of sheets) {
  const rows = sheet.rows || []
  const matches = rows.filter(r => (r.order_number||'').includes('260522008') && r.factory === 'O')
  for (const r of matches) {
    console.log('Sheet:', sheet.sheet_date, '| order_number:', r.order_number, '| item_code:', r.item_code, '| match_status:', r.match_status, '| po_number:', r.po_number)
    console.log('order_number chars:', [...(r.order_number||'')].map(c => c + '(' + c.charCodeAt(0) + ')').join(' '))
  }
}
