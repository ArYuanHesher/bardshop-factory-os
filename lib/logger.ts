import { supabase } from './supabaseClient'

/**
 * 寫入系統操作日誌
 * @param userName 操作者名稱
 * @param actionType 動作類型 (例如: '新增訂單', '刪除', '排程分配')
 * @param target 目標對象 (例如: 'ORD-2023001', '印刷機-A')
 * @param details 詳細說明 (選填)
 */
export const logSystemAction = async (
  userName: string, 
  actionType: string, 
  target: string, 
  details: string = ''
) => {
  try {
    const { error } = await supabase.from('system_logs').insert({
      user_name: userName,
      action_type: actionType,
      target_resource: target,
      details: details,
    })

    if (error) {
      console.error('日誌寫入失敗:', error)
    }
  } catch (err) {
    console.error('Logger Error:', err)
  }
}