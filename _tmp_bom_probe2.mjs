/**
 * 確認 IFAF019/021/024 真正接受的欄位 + 寫入後驗證
 */
const API_BASE = 'http://140.245.91.36/ords/workstation/ArgoAPI'
const USERNAME = 'ARGOIFAF', PASSWORD = 'ARGOIFAF', SEGMENT = 'BARDSHOP'

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const text = await r.text()
  try { return { ok: r.ok, data: JSON.parse(text), raw: text } }
  catch { return { ok: r.ok, data: null, raw: text.slice(0, 500) } }
}

const keyRes = await post(API_BASE + '/S_APIKEY', { username: USERNAME, password: PASSWORD })
const { APIKEY1: k1, APIKEY2: k2, APIKEY3: k3 } = keyRes.data.RESULT
const base = { APIKEY1: k1, APIKEY2: k2, APIKEY3: k3, SEGMENT, IMP: 'Y' }
console.log('✅ Keys OK\n')

// 完整印出 RESULT
async function tryImport(ifId, data, label) {
  const r = await post(API_BASE + '/S_IMPORT', {
    sparam: JSON.stringify({ ...base, INTERFACE: ifId, DATA: data })
  })
  console.log(`\n[${ifId}] ${label}`)
  console.log('  STATUS:', r.data?.STATUS)
  console.log('  ERROR :', r.data?.ERROR)
  console.log('  RESULT:', JSON.stringify(r.data?.RESULT).slice(0, 400))
  console.log('  RAW   :', r.raw.slice(0, 400))
  return r.data?.STATUS
}

// ── 用 MM_BOM_STRUCTURE 的實際欄位逐一試 ─────────────
// 已知 MBP_PART, MBP_VER, LINE_NO 可接受；MBP_CHILD_PART 不行
// 試 MM_BOM_STRUCTURE 其他欄位：
const bomStructCols = [
  'CHILD_SCRAP2', 'LOT_CHILD_QTY', 'LOT_BASE', 'REMARK', 'ALLO_RATE',
  'USER_LINE_NO', 'PO_REMARK', 'TPN_PARTNER_ID',
]

// 先確認 MBP_PART+MBP_VER+LINE_NO 的完整回應
await tryImport('IFAF019', [{ MBP_PART: 'TEST_PARENT', MBP_VER: '1', LINE_NO: '1' }], '基本三欄')

// 逐一加入欄位看哪個報錯
for (const col of bomStructCols) {
  const data = [{ MBP_PART: 'TEST_PARENT', MBP_VER: '1', LINE_NO: '1', [col]: 'TEST' }]
  await tryImport('IFAF019', data, `加入 ${col}`)
}

// ── 這些 INTERFACE 可能是 MM_BOM_PART（料號主檔）而非結構 ─
// MM_BOM_PART 欄位：PART, PART_DESC, UNIT_OF_MEASURE...
console.log('\n\n=== 測試 MM_BOM_PART 欄位 ===')
await tryImport('IFAF019', [{ PART: 'TEST_PART', PART_DESC: 'Test Desc', UNIT_OF_MEASURE: 'PCS' }], 'MM_BOM_PART 欄位')
await tryImport('IFAF021', [{ PART: 'TEST_PART', PART_DESC: 'Test Desc', UNIT_OF_MEASURE: 'PCS' }], 'MM_BOM_PART 欄位')
await tryImport('IFAF024', [{ PART: 'TEST_PART', PART_DESC: 'Test Desc', UNIT_OF_MEASURE: 'PCS' }], 'MM_BOM_PART 欄位')

// ── 查 MM_BOM_PART 看看欄位 ──
console.log('\n=== 查 MM_BOM_PART 欄位清單 ===')
const rPart = await post(API_BASE + '/S_QUERY', {
  sparam: JSON.stringify({ APIKEY1: k1, APIKEY2: k2, APIKEY3: k3, SEGMENT,
    TABLE: 'MM_BOM_PART', SHOWNULLCOLUMN: 'Y', ROWNUM: '<= 1' })
})
const row = Array.isArray(rPart.data?.RESULT) ? rPart.data.RESULT[0] : null
if (row) console.log('  欄位:', Object.keys(row).join(', '))
else console.log('  結果:', rPart.raw.slice(0, 200))

console.log('\n完成')
