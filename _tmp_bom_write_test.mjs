/**
 * 測試 ARGO ERP 是否有開放 BOM 結構寫入 INTERFACE
 * 策略：
 *  1. 查詢已知 INTERFACE 清單表（IF_INTERFACE / IF_INTERFACE_HEAD）
 *  2. 嘗試常見 BOM 相關 INTERFACE 代號（IFAF_BOM / IFAF020 ~ IFAF030 等）
 *  3. 用一筆虛假資料試打 S_IMPORT，觀察錯誤訊息
 */

const API_BASE  = 'http://140.245.91.36/ords/workstation/ArgoAPI'
const USERNAME  = 'ARGOIFAF'
const PASSWORD  = 'ARGOIFAF'
const SEGMENT   = 'BARDSHOP'

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  try { return { ok: r.ok, status: r.status, data: JSON.parse(text) } }
  catch { return { ok: r.ok, status: r.status, data: null, raw: text.slice(0, 500) } }
}

// ── 取得 API Keys ─────────────────────────────────────
const keyRes = await post(API_BASE + '/S_APIKEY', { username: USERNAME, password: PASSWORD })
if (!keyRes.ok || !keyRes.data?.RESULT) {
  console.error('❌ 取得 Key 失敗', keyRes.raw ?? keyRes.data)
  process.exit(1)
}
const { APIKEY1: k1, APIKEY2: k2, APIKEY3: k3 } = keyRes.data.RESULT
const base = { APIKEY1: k1, APIKEY2: k2, APIKEY3: k3, SEGMENT }
console.log('✅ Keys OK\n')

// ── Step 1：查 INTERFACE 主檔，找 BOM 相關條目 ───────────
console.log('=== Step 1: 查 IF_INTERFACE 是否存在 ===')
const ifTables = ['IF_INTERFACE', 'IF_INTERFACE_HEAD', 'IF_INTERFACEHEAD', 'SYS_INTERFACE']
for (const tbl of ifTables) {
  const r = await post(API_BASE + '/S_QUERY', {
    sparam: JSON.stringify({ ...base, TABLE: tbl, SHOWNULLCOLUMN: 'N', ROWNUM: '<= 3' })
  })
  const result = r.data?.RESULT
  if (r.data?.STATUS === 'E' || r.data?.MESSAGE?.includes('未授權') || r.data?.MESSAGE?.includes('ORA-')) {
    console.log(`  ${tbl}: ❌ ${r.data?.MESSAGE ?? r.data?.STATUS}`)
  } else if (Array.isArray(result) && result.length > 0) {
    console.log(`  ${tbl}: ✅ 有資料，第一筆 keys = ${Object.keys(result[0]).join(', ')}`)
    // 找 BOM 相關
    const bomRows = result.filter(row =>
      Object.values(row).some(v => String(v).toUpperCase().includes('BOM'))
    )
    if (bomRows.length) console.log('    BOM 相關:', JSON.stringify(bomRows[0]))
  } else {
    console.log(`  ${tbl}: ⚠️ 空或格式異常`, JSON.stringify(r.data).slice(0, 150))
  }
}

// ── Step 2：直接嘗試常見 BOM 寫入 INTERFACE 代號 ─────────
console.log('\n=== Step 2: 測試常見 BOM INTERFACE 代號（用假資料，只看錯誤訊息）===')
const candidates = [
  'IFAF_BOM',
  'IFAF_BOM01',
  'IFAF_BOM_STRUCTURE',
  'IFAF015',
  'IFAF016',
  'IFAF017',
  'IFAF018',
  'IFAF019',
  'IFAF020',
  'IFAF021',
  'IFAF022',
  'IFAF023',
  'IFAF024',
  'IFAF025',
]

// 假資料：一筆 BOM 結構（母件→子件）
const fakeData = [
  {
    MBP_PART:       'TEST_PARENT',
    MBP_VER:        '1',
    MBP_CHILD_PART: 'TEST_CHILD',
    MBP_CHILD_VER:  '1',
    LINE_NO:        '1',
    CHILD_QTY:      '1',
    CHILD_SCRAP:    '0',
  }
]

for (const ifId of candidates) {
  const r = await post(API_BASE + '/S_IMPORT', {
    sparam: JSON.stringify({
      ...base,
      IMP: 'Y',
      INTERFACE: ifId,
      DATA: fakeData,
    })
  })
  const msg   = r.data?.MESSAGE ?? r.data?.RESULT?.MESSAGE ?? r.raw ?? JSON.stringify(r.data).slice(0, 200)
  const status = r.data?.STATUS ?? (r.ok ? 'OK' : 'HTTP_ERR')
  // 「介面不存在」「未找到」= 不存在；其他錯誤（欄位錯誤/資料錯誤）= 介面存在但資料錯
  const exists = !String(msg).includes('不存在') &&
                 !String(msg).includes('找不到') &&
                 !String(msg).includes('INTERFACE NOT FOUND') &&
                 !String(msg).includes('Invalid interface') &&
                 status !== 'HTTP_ERR'
  console.log(`  ${ifId}: [${status}] ${exists ? '⭐ 可能存在' : '✗ 不存在'} — ${String(msg).slice(0, 120)}`)
}

// ── Step 3：查 MM_BOM_STRUCTURE 本身的 table 說明，找欄位 ─
console.log('\n=== Step 3: 確認 MM_BOM_STRUCTURE 完整欄位 ===')
const r3 = await post(API_BASE + '/S_QUERY', {
  sparam: JSON.stringify({ ...base, TABLE: 'MM_BOM_STRUCTURE', SHOWNULLCOLUMN: 'Y', MBP_PART: 'IS NOT NULL', ROWNUM: '<= 1' })
})
const row3 = Array.isArray(r3.data?.RESULT) ? r3.data.RESULT[0] : null
if (row3) {
  console.log('  所有欄位:', Object.keys(row3).join(', '))
} else {
  console.log('  無法取得欄位', JSON.stringify(r3.data).slice(0, 200))
}

console.log('\n測試完成')
