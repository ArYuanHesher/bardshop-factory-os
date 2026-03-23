import { NextRequest, NextResponse } from 'next/server'

/**
 * 暫時性 endpoint：接收 LINE Webhook 事件，用於取得 Group ID。
 * 把 Bot 加入群組後，LINE 會發送 join 事件到這裡，
 * response 中會包含 groupId，記下後設入環境變數即可刪除此檔案。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('=== LINE Webhook Event ===')
    console.log(JSON.stringify(body, null, 2))

    // 解析事件中的 groupId
    const events = body.events || []
    for (const event of events) {
      if (event.source?.groupId) {
        console.log('✅ GROUP ID:', event.source.groupId)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
