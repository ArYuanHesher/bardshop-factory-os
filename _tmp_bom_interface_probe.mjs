/**
 * 深入探測 IFAF019 / IFAF021 / IFAF024
 * 策略：逐步減少欄位，找出各 INTERFACE 接受的最小欄位集
 */

const API_BASE = 'http://140.245.91.36/ords/workstation/ArgoAPI'
const USERNAME = 'ARGOIFAF', PASSWORD = 'ARGOIFAF', SEGMENT = 'BARDSHOP'

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const text = await r.text()
  try { return { ok: r.ok, data: JSON.parse(text) } }
  catch { return { ok: r.ok, data: null, raw: text.slice(0, 500) } }
}

const keyRes = await post(API_BASE + '/S_APIKEY', { username: USERNAME, password: PASSWORD })
const { APIKEY1: k1, APIKEY2: k2, APIKEY3: k3 } = keyRes.data.RESULT
const base = { APIKEY1: k1, APIKEY2: k2, APIKEY3: k3, SEGMENT, IMP: 'Y' }
console.log('✅ Keys OK\n')

async function tryImport(ifId, data) {
  const r = await post(API_BASE + '/S_IMPORT', {
    sparam: JSON.stringify({ ...base, INTERFACE: ifId, DATA: data })
  })
  const msg = r.data?.ERROR ?? r.data?.MESSAGE ?? r.data?.RESULT ?? r.raw ?? JSON.stringify(r.data)
  const status = r.data?.STATUS ?? '?'
  return { status, msg: String(msg).slice(0, 200) }
}

// ── 各候選欄位集 ──────────────────────────────────────
// Step 3 取得的完整欄位清單：
// MBP_PART, MBP_VER, MBP_CHILD_PART, MBP_CHILD_VER, CHILD_QTY, CHILD_SCRAP,
// CHILD_ECNNBR, PART_ECNNBR, CREATE_BY, CREATE_DATE, UPDATE_BY, UPDATE_DATE,
// MBP_CHILD_PART_NO, MBP_CHILD_LOT_NO, MBP_CHILD_DATECODE, MBP_PART_NO,
// MBP_LOT_NO, MBP_DATECODE, CREATE_PROGRAM, UPDATE_PROGRAM, SEG_SEGMENT_NO,
// LINE_NO, REMARK, CHILD_SCRAP2, LOT_CHILD_QTY, LOT_BASE, PO_COMPANY,
// TPN_PARTNER_ID, PO_REMARK, ALLO_RATE, USER_LINE_NO

// 從最小開始試（只有主鍵欄位），逐步加欄位
const testSets = [
  // 最小：只有母件
  { label: '只有 MBP_PART',               data: [{ MBP_PART: 'TEST_PARENT' }] },
  // 主鍵欄位
  { label: 'MBP_PART + LINE_NO',           data: [{ MBP_PART: 'TEST_PARENT', LINE_NO: '1' }] },
  // ARGO MM_BOM_HEAD 欄位嘗試
  { label: 'MBP_PART + MBP_VER + LINE_NO', data: [{ MBP_PART: 'TEST_PARENT', MBP_VER: '1', LINE_NO: '1' }] },
  // 加子件
  { label: '母件+子件基本',
    data: [{ MBP_PART: 'TEST_PARENT', MBP_VER: '1', LINE_NO: '1',
             MBP_CHILD_PART: 'TEST_CHILD', MBP_CHILD_VER: '1', CHILD_QTY: '1' }] },
  // 用 CUSTOMCOLUMN 形式（有些 interface 只接受特定欄位名）
  { label: '別名欄位：PARENT_PART / CHILD_PART',
    data: [{ PARENT_PART: 'TEST_PARENT', CHILD_PART: 'TEST_CHILD', QTY: '1', LINE_NO: '1' }] },
  // ARGO 介面常見命名：ITEM_CODE
  { label: '別名：ITEM_CODE / COMP_CODE',
    data: [{ ITEM_CODE: 'TEST_PARENT', COMP_CODE: 'TEST_CHILD', COMP_QTY: '1', LINE_NO: '1' }] },
]

for (const ifId of ['IFAF019', 'IFAF021', 'IFAF024']) {
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`🔍 探測 ${ifId}`)
  console.log('─'.repeat(50))
  for (const ts of testSets) {
    const r = await tryImport(ifId, ts.data)
    const icon = r.msg.includes('invalid column') ? '❌ 欄位錯' :
                 r.msg.includes('未授權')         ? '🔒 無授權' :
                 r.msg.includes('成功') || r.msg.includes('SUCCESS') ? '✅ 成功' :
                 r.status === '1'                  ? '✅ 可能成功' : '⚠️  其他'
    console.log(`  [${r.status}] ${icon} ${ts.label}`)
    console.log(`         → ${r.msg}`)
  }
}

// ── 額外：S_QUERY 查 IFAF019/021/024 的定義（若有系統表可查）─
console.log('\n=== 嘗試查 MM_BOM_INTERFACE / MM_BOM_COMP 相關表 ===')
const extraTables = ['MM_BOM_HEAD', 'MM_BOM_COMP', 'MM_BOM_DETAIL', 'MM_BOM_INTERFACE']
for (const tbl of extraTables) {
  const r = await post(API_BASE + '/S_QUERY', {
    sparam: JSON.stringify({ ...base, IMP: undefined, TABLE: tbl, SHOWNULLCOLUMN: 'N', ROWNUM: '<= 1' })
  })
  const msg = r.data?.ERROR ?? r.data?.MESSAGE ?? (Array.isArray(r.data?.RESULT) ? `✅ 有資料，欄位: ${Object.keys(r.data.RESULT[0] ?? {}).join(', ')}` : JSON.stringify(r.data).slice(0,150))
  console.log(`  ${tbl}: ${msg}`)
}

console.log('\n完成')
