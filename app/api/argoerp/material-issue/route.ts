import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '../../../../lib/supabaseAdmin'

interface IssueBody {
  slip_no?: string
  line_no?: number
}

export async function POST(req: NextRequest) {
  const body = await req.json() as IssueBody
  const { slip_no, line_no } = body
  if (!slip_no || line_no == null) {
    return NextResponse.json({ error: 'slip_no and line_no required' }, { status: 400 })
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('erp_material_issue_status')
    .upsert({ slip_no, line_no }, { onConflict: 'slip_no,line_no' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'ok' })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json() as IssueBody
  const { slip_no, line_no } = body
  if (!slip_no || line_no == null) {
    return NextResponse.json({ error: 'slip_no and line_no required' }, { status: 400 })
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('erp_material_issue_status')
    .delete()
    .eq('slip_no', slip_no)
    .eq('line_no', line_no)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'ok' })
}
