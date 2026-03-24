import { NextRequest, NextResponse } from 'next/server'

const LINE_CHANNEL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
const LINE_GROUP_IDS = (process.env.LINE_GROUP_ID || '').split(',').map(id => id.trim()).filter(Boolean)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 1. 驗證 Supabase Webhook 來源
    const authHeader = request.headers.get('authorization')
    if (WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!LINE_CHANNEL_TOKEN || LINE_GROUP_IDS.length === 0) {
      return NextResponse.json({ error: 'LINE credentials not configured' }, { status: 500 })
    }

    const record = body.record
    const oldRecord = body.old_record
    const eventType = body.type // INSERT or UPDATE

    if (!record) {
      return NextResponse.json({ error: 'No record in payload' }, { status: 400 })
    }

    // UPDATE 事件：只在狀態變更為已完成時才通知
    if (eventType === 'UPDATE') {
      if (!oldRecord || oldRecord.status === record.status) {
        return NextResponse.json({ ok: true, skipped: 'status not changed' })
      }
    }

    // 2. 組裝 LINE 訊息
    const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })

    const statusText = record.status === 'pending' ? '🔴 待處理' : '🟢 已完成'

    const isUpdate = eventType === 'UPDATE'
    const title = isUpdate ? '✅ 【異常單處理完成】' : '🚨 【異常單通知】'

    const lines = [
      title,
      '',
      `📋 工單編號：${record.order_number || '-'}`,
      `⚠️ 異常原因：${record.reason || '-'}`,
      `🏷️ 分類：${record.qa_category || '-'}`,
      `🏢 回報部門：${record.qa_department || '-'}`,
      `👤 回報人員：${record.qa_reporter || '-'}`,
      `🏭 處理部門：${record.handler_department || '-'}`,
      `🔧 處理人員：${(record.handler_names || []).join('、') || '-'}`,
      `📌 狀態：${statusText}`,
      `🕐 通知時間：${now}`,
    ]

    if (isUpdate && record.handler_record) {
      lines.splice(lines.length - 2, 0, `📝 處理紀錄：${record.handler_record}`)
    }

    const message = lines.join('\n')

    // 3. 推送到所有 LINE 群組
    const results = await Promise.allSettled(
      LINE_GROUP_IDS.map(groupId =>
        fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`,
          },
          body: JSON.stringify({
            to: groupId,
            messages: [{ type: 'text', text: message }],
          }),
        })
      )
    )

    const failures = results.filter(r => r.status === 'rejected')
    if (failures.length > 0) {
      console.error('Some LINE pushes failed:', failures)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
