import { NextRequest, NextResponse } from 'next/server'

const LINE_CHANNEL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
const LINE_GROUP_ID = process.env.LINE_GROUP_ID || ''
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ''

export async function POST(request: NextRequest) {
  // 1. 驗證 Supabase Webhook 來源
  const authHeader = request.headers.get('authorization')
  if (!WEBHOOK_SECRET || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!LINE_CHANNEL_TOKEN || !LINE_GROUP_ID) {
    return NextResponse.json({ error: 'LINE credentials not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const record = body.record

    if (!record) {
      return NextResponse.json({ error: 'No record in payload' }, { status: 400 })
    }

    // 2. 組裝 LINE 訊息
    const createdAt = record.created_at
      ? new Date(record.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
      : '-'

    const statusText = record.status === 'pending' ? '🔴 待處理' : '🟢 已確認'

    const lines = [
      '🚨 【異常單通知】',
      '',
      `📋 工單編號：${record.order_number || '-'}`,
      `⚠️ 異常原因：${record.reason || '-'}`,
      `🏷️ 分類：${record.qa_category || '-'}`,
      `🏢 部門：${record.qa_department || '-'}`,
      `👤 回報人：${record.qa_reporter || '-'}`,
      `📌 狀態：${statusText}`,
      `🕐 時間：${createdAt}`,
    ]

    if (record.handler_record) {
      lines.push(`📝 處理紀錄：${record.handler_record}`)
    }

    const message = lines.join('\n')

    // 3. 推送到 LINE 群組
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_TOKEN}`,
      },
      body: JSON.stringify({
        to: LINE_GROUP_ID,
        messages: [{ type: 'text', text: message }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('LINE push failed:', err)
      return NextResponse.json({ error: 'LINE push failed', detail: err }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
