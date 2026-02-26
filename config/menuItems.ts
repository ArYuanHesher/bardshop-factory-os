export const NAV_GROUPS = [
  {
    title: '訂單資料管理',
    theme: 'purple',
    items: [
      // 1. 原「每日訂單作業」
      { 
        name: '訂單更新表', 
        path: '/admin/daily', 
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' 
      },
      // 2. 原「歷史訂單查詢」
      { 
        name: '發單紀錄總表(上傳成功)', 
        path: '/admin/history', 
        icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' 
      },
      // 3. 原「各站工時轉換」
      { 
        name: '各站工時轉換表', 
        path: '/admin/history/conversion', 
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' 
      },
      // 4. 原「各站工時總表」
      { 
        name: '各站工時查詢表(轉換成功)', 
        path: '/admin/orders/master', 
        icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' 
      },
      // 5. 🔥 新增：待處理資料表
      { 
        name: '待處理資料表', 
        path: '/admin/pending', 
        icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' 
      },
    ]
  },
  {
   title: '生產管理入口',
    theme: 'blue',
    items: [
      { 
        name: '待排程表', 
        path: '/admin/schedule/pending', 
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' 
      },
      { 
        name: '排程總表', 
        path: '/admin/schedule/list', 
        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' 
      },
    ]
  },
  {
    title: '產線排程看板', // 新分類
    theme: 'purple',
    items: [
      { name: '印刷排程', path: '/admin/production/printing', icon: '...' },
      { name: '雷切排程', path: '/admin/production/laser', icon: '...' },
      { name: '後加工排程', path: '/admin/production/post', icon: '...' },
      { name: '包裝排程', path: '/admin/production/packaging', icon: '...' },
      { name: '委外排程', path: '/admin/production/outsourced', icon: '...' },
      { name: '常平排程', path: '/admin/production/changping', icon: '...' },
   ]
  },
  {
    title: '物料管理',
    theme: 'cyan',
    items: [
      {
        name: '物料清單',
        path: '/admin/materials',
        icon: 'M20 7H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM7 11h10M7 15h6'
      },
      {
        name: 'BOM表',
        path: '/admin/materials/bom',
        icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
      },
      {
        name: '替代料號設定',
        path: '/admin/materials/substitute',
        icon: 'M4 7h16M4 12h10m-10 5h16'
      },
    ]
  },
  {
    title: '工序資料庫',
    theme: 'green',
    items: [
      { name: '工序總表查詢', path: '/admin/database', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
      { name: '工序總表更新', path: '/admin/upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
    ]
  },
  // 系統設定群組已移除
]