import { createClient } from '@supabase/supabase-js'

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = Buffer.from(padded, 'base64').toString('utf8')
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
}

export function formatSupabaseAdminError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid api key') || normalized.includes('invalid jwt')) {
    return 'Supabase Admin 金鑰無效。請確認 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY 來自同一個 Supabase 專案，並同步更新本機與 Vercel 環境變數。'
  }

  if (normalized.includes('project mismatch')) {
    return message
  }

  return message
}

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const missingVars: string[] = []
    if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!supabaseServiceRoleKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE)')
    throw new Error(`Missing Supabase admin environment variables: ${missingVars.join(', ')}`)
  }

  const urlProjectRef = (() => {
    try {
      return new URL(supabaseUrl).hostname.split('.')[0]
    } catch {
      return ''
    }
  })()

  const jwtPayload = decodeJwtPayload(supabaseServiceRoleKey)
  const keyProjectRef = typeof jwtPayload?.ref === 'string' ? jwtPayload.ref : ''

  if (urlProjectRef && keyProjectRef && urlProjectRef !== keyProjectRef) {
    throw new Error(
      `Supabase project mismatch: NEXT_PUBLIC_SUPABASE_URL is '${urlProjectRef}', but SUPABASE_SERVICE_ROLE_KEY belongs to '${keyProjectRef}'.`
    )
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
