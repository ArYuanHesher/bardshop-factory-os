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
      
       { name: '環境參數設定', path: '/admin/settings/parameters', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
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
      { name: '排程異常回報', path: '/admin/production/anomaly', icon: '...' },
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
  {
    title: '系統設定',
    theme: 'orange',
    items: [
      { name: '組織成員管理', path: '/admin/team', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
      { name: '公告設定', path: '/admin/settings/announcements', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
    ]
  }
]