const API_BASE = 'http://140.245.91.36/ords/workstation/ArgoAPI';
const USERNAME = 'ARGOIFAF', PASSWORD = 'ARGOIFAF', SEGMENT = 'BARDSHOP';

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  try { return JSON.parse(text); } catch { console.error('RAW:', text.slice(0, 300)); return null; }
}

const keyData = await post(API_BASE + '/S_APIKEY', { username: USERNAME, password: PASSWORD });
if (!keyData) process.exit(1);
const { APIKEY1: k1, APIKEY2: k2, APIKEY3: k3 } = keyData.RESULT;
console.log('Keys OK');

// 確認 MM_BOM_STRUCTURE 用 CUSTOMCOLUMN 還是不帶的回傳結果
const base = { APIKEY1: k1, APIKEY2: k2, APIKEY3: k3, SEGMENT };

// 方法 A：不帶 CUSTOMCOLUMN（測試時成功的寫法）
const rA = await post(API_BASE + '/S_QUERY', {
  sparam: JSON.stringify({ ...base, TABLE: 'MM_BOM_STRUCTURE', SHOWNULLCOLUMN: 'N', MBP_PART: 'IS NOT NULL', ROWNUM: '<= 2' })
});
console.log('A (no customColumn):', JSON.stringify(rA?.RESULT?.[0]).slice(0,200));

// 方法 B：帶 CUSTOMCOLUMN（目前 route.ts 寫法）
const rB = await post(API_BASE + '/S_QUERY', {
  sparam: JSON.stringify({ ...base, TABLE: 'MM_BOM_STRUCTURE', SHOWNULLCOLUMN: 'N',
    CUSTOMCOLUMN: 'MBP_PART,MBP_VER,MBP_CHILD_PART,MBP_CHILD_VER,LINE_NO,CHILD_QTY,CHILD_SCRAP,LOT_CHILD_QTY,LOT_BASE',
    MBP_PART: 'IS NOT NULL', ROWNUM: '<= 2' })
});
console.log('B (with customColumn):', JSON.stringify(rB).slice(0,300));
