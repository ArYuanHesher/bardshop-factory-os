import { NextRequest, NextResponse } from 'next/server'
import { saraFetch, getSaraTokenCacheState, getSaraToken } from '@/lib/saraClient'
import { syncWorkcenters, syncJobs, syncOrders, syncResources, syncLotRoutes, syncReports, type LotDetailItem } from '@/lib/saraSync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * SARA 代理路由（避免 client_secret 暴露到瀏覽器）
 *
 * GET  /api/sara          → 回傳目前 token 快取狀態
 * GET  /api/sara?action=ping  → 立即取得 / 刷新 token
 * POST /api/sara          body: { action: 'order'|'report'|'workcenter'|'jlb'|'resource'|'lot_detail'|'ping', body?: any }
 *                         → 代理呼叫 SARA 對應端點
 */

const ACTION_MAP: Record<string, string> = {
  order:      '/data/order',
  workcenter: '/data/workcenter',
  jlb:        '/data/jlb',
  resource:   '/data/resource',
  lot_detail: '/data/lot_detail',
}

function getReportPaths(): string[] {
  const fromEnv = (process.env.SARA_REPORT_PATHS || process.env.SARA_REPORT_PATH || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (fromEnv.length > 0) return fromEnv

  return [
    '/data/report',
    '/data/work_report',
    '/data/reports',
    '/data/workreport',
    '/data/report_list',
    '/data/reporting',
  ]
}

function getReportPathsFromBody(body: unknown): string[] | null {
  if (!body || typeof body !== 'object') return null
  const reportPaths = (body as { reportPaths?: unknown }).reportPaths
  if (!Array.isArray(reportPaths)) return null
  const cleaned = reportPaths.map(v => String(v ?? '').trim()).filter(Boolean)
  return cleaned.length > 0 ? cleaned : null
}

function getReportRequestBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return {}
  const raw = (body as { reportBody?: unknown }).reportBody
  return raw && typeof raw === 'object' ? raw : {}
}

function is404ErrorMessage(msg: string): boolean {
  return /(HTTP\s*404|\b404\b|Not\s+Found)/i.test(msg)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'ping') {
    try {
      const token = await getSaraToken(true)
      return NextResponse.json({
        ok: true,
        message: '已成功取得 SARA token',
        tokenPreview: token.slice(0, 16) + '...',
        tokenLength: token.length,
        cache: getSaraTokenCacheState(),
      })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
  }

  if (action === 'raw_token') {
    // Debug：直接呼叫 temp_token 端點，回傳原始 JSON（不含 secret）
    try {
      const base = process.env.SARA_BASE_URL?.replace(/\/+$/, '') || 'https://sara-factory.com/api/data_export'
      const secret = process.env.SARA_CLIENT_SECRET
      if (!secret) return NextResponse.json({ ok: false, error: '未設定 SARA_CLIENT_SECRET' }, { status: 500 })
      const res = await fetch(`${base}/temp_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_secret: secret }),
        cache: 'no-store',
      })
      const text = await res.text()
      let body: unknown = text
      try { body = JSON.parse(text) } catch { /* ignore */ }
      return NextResponse.json({ ok: res.ok, status: res.status, body })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    cache: getSaraTokenCacheState(),
    actions: Object.keys(ACTION_MAP).concat(['ping']),
  })
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => ({})) as { action?: string; body?: unknown }
    const action = json.action ?? ''

    if (action === 'ping') {
      const token = await getSaraToken(true)
      return NextResponse.json({
        ok: true,
        tokenPreview: token.slice(0, 16) + '...',
        cache: getSaraTokenCacheState(),
      })
    }

    // 同步入庫類動作
    if (action.startsWith('sync_')) {
      const started = Date.now()
      let result: { count: number; message?: string }
      const customReportPaths = getReportPathsFromBody(json.body)
      const reportRequestBody = getReportRequestBody(json.body)
      switch (action) {
        case 'sync_workcenter': result = await syncWorkcenters(); break
        case 'sync_jlb':        result = await syncJobs(); break
        case 'sync_order':      result = await syncOrders(); break
        case 'sync_report':     result = await syncReports(customReportPaths ?? getReportPaths(), reportRequestBody); break
        case 'sync_resource':   result = await syncResources(); break
        case 'sync_lot_detail': {
          const items = (json.body as { items?: LotDetailItem[] } | undefined)?.items
          if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ ok: false, error: 'sync_lot_detail 需要 body.items' }, { status: 400 })
          }
          result = await syncLotRoutes(items)
          break
        }
        default:
          return NextResponse.json({ ok: false, error: `未知 sync action: ${action}` }, { status: 400 })
      }
      return NextResponse.json({
        ok: true,
        action,
        elapsedMs: Date.now() - started,
        count: result.count,
        message: result.message,
      })
    }

    if (action === 'report') {
      const tried: string[] = []
      const errors: string[] = []
      const reportPaths = getReportPathsFromBody(json.body) ?? getReportPaths()
      const reportRequestBody = getReportRequestBody(json.body)
      for (const path of reportPaths) {
        tried.push(path)
        try {
          const started = Date.now()
          const data = await saraFetch(path, reportRequestBody)
          const elapsed = Date.now() - started
          const arr = (data as { data?: unknown[] })?.data
          return NextResponse.json({
            ok: true,
            action,
            pathUsed: path,
            tried,
            elapsedMs: elapsed,
            count: Array.isArray(arr) ? arr.length : null,
            result: data,
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          errors.push(`${path}: ${msg}`)
          if (!is404ErrorMessage(msg)) {
            return NextResponse.json({ ok: false, action, tried, error: msg }, { status: 500 })
          }
        }
      }
      return NextResponse.json({
        ok: false,
        action,
        tried,
        error: `找不到可用的報工端點（皆回 404）：${tried.join(', ')}`,
        hint: '請向 SARA 確認報工 API 路徑或權限範圍，並可於 .env.local 設定 SARA_REPORT_PATH 或 SARA_REPORT_PATHS 覆蓋候選路徑。',
        details: errors,
      }, { status: 404 })
    }

    const path = ACTION_MAP[action]
    if (!path) {
      return NextResponse.json({ ok: false, error: `未知 action: ${action}` }, { status: 400 })
    }

    const started = Date.now()
    const data = await saraFetch(path, json.body ?? {})
    const elapsed = Date.now() - started

    // SARA 回傳格式 { data: [...] } - 順手算筆數
    const arr = (data as { data?: unknown[] })?.data
    return NextResponse.json({
      ok: true,
      action,
      elapsedMs: elapsed,
      count: Array.isArray(arr) ? arr.length : null,
      result: data,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
