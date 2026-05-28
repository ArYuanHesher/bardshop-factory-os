const API_BASE = 'http://140.245.91.36/ords/workstation/ArgoAPI';
const USERNAME = 'ARGOIFAF', PASSWORD = 'ARGOIFAF', SEGMENT = 'BARDSHOP';
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  try { return JSON.parse(text); } catch { console.error('RAW:', text.slice(0,300)); return null; }
}
const keyData = await post(API_BASE + '/S_APIKEY', { username: USERNAME, password: PASSWORD });
const { APIKEY1: k1, APIKEY2: k2, APIKEY3: k3 } = keyData.RESULT;

// 1. MM_BOM_PART 前 2 筆，不指定 CUSTOMCOLUMN → 全欄位
const rPart = await post(API_BASE + '/S_QUERY', {
  sparam: JSON.stringify({
    APIKEY1: k1, APIKEY2: k2, APIKEY3: k3, SEGMENT,
    TABLE: 'MM_BOM_PART', SHOWNULLCOLUMN: 'N',
    PART: 'IS NOT NULL', ROWNUM: '<= 2'
  })
});
const partRows = rPart?.RESULT ?? [];
console.log('\n=== MM_BOM_PART 欄位 ===');
if (partRows.length > 0) {
  console.log('欄位:', Object.keys(partRows[0]).join(', '));
  console.log('第1筆:', JSON.stringify(partRows[0], null, 2));
} else {
  console.log('查無資料', JSON.stringify(rPart).slice(0,300));
}

// 2. MM_BOM_STRUCTURE 前 2 筆，全欄位
const rStr = await post(API_BASE + '/S_QUERY', {
  sparam: JSON.stringify({
    APIKEY1: k1, APIKEY2: k2, APIKEY3: k3, SEGMENT,
    TABLE: 'MM_BOM_STRUCTURE', SHOWNULLCOLUMN: 'N',
    MBP_PART: 'IS NOT NULL', ROWNUM: '<= 2'
  })
});
const strRows = rStr?.RESULT ?? [];
console.log('\n=== MM_BOM_STRUCTURE 欄位 ===');
if (strRows.length > 0) {
  console.log('欄位:', Object.keys(strRows[0]).join(', '));
  console.log('第1筆:', JSON.stringify(strRows[0], null, 2));
} else {
  console.log('查無資料', JSON.stringify(rStr).slice(0,300));
}
