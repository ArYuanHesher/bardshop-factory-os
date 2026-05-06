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
console.log('Keys OK:', k1, k2);

// ARGO S_QUERY filter 值需包含算符，例如 "= 'xxx'" 或 ">= 100"
const PART = 'P3CMOUB-KZ3080';

for (const [tbl, filters] of [
  // 正確格式：value 含算符
  ['MM_BOM_PART', { PART: `= '${PART}'` }],
]) {
  const d = await post(API_BASE + '/S_QUERY', {
    sparam: JSON.stringify({
      APIKEY1: k1, APIKEY2: k2, APIKEY3: k3,
      SEGMENT, TABLE: tbl, SHOWNULLCOLUMN: 'Y',
      ...filters,
    }),
  });
  const rows = d && Array.isArray(d.RESULT) ? d.RESULT : [];
  if (rows.length > 0) {
    console.log(`\n=== ${tbl} (${rows.length} rows) ===`);
    console.log('Columns:', Object.keys(rows[0]).join(', '));
    const unitFields = Object.entries(rows[0]).filter(([k]) => k.toUpperCase().includes('UNIT'));
    console.log('UNIT fields:', JSON.stringify(unitFields));
    console.log('First row:', JSON.stringify(rows[0]));
  } else {
    console.log(`\n=== ${tbl} === no rows`);
    if (d) console.log(JSON.stringify(d).slice(0, 400));
  }
}
