import { supabase } from './supabaseClient'

type LogPayload = {
  actionType: string
  target: string
  module?: string
  details?: string
  metadata?: Record<string, unknown>
}

const resolveCurrentActor = async () => {
  const { data: authData } = await supabase.auth.getUser()
  const authUser = authData?.user

  if (!authUser?.email) {
    return {
      actorUserId: null,
      userName: 'Unknown',
      userEmail: null,
      userDepartment: null,
    }
  }

  let member: { real_name: string | null; department: string | null; email: string | null } | null = null

  const { data: memberByAuthId } = await supabase
    .from('members')
    .select('real_name, department, email')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  member = memberByAuthId

  if (!member) {
    const { data: memberByEmail } = await supabase
      .from('members')
      .select('real_name, department, email')
      .eq('email', authUser.email)
      .maybeSingle()
    member = memberByEmail
  }

  return {
    actorUserId: authUser.id,
    userName: member?.real_name || authUser.email,
    userEmail: member?.email || authUser.email,
    userDepartment: member?.department || null,
  }
}

export const logSystemAction = async (
  actionTypeOrPayload: string | LogPayload,
  target?: string,
  details: string = '',
  metadata: Record<string, unknown> = {}
) => {
  try {
    const payload: LogPayload =
      typeof actionTypeOrPayload === 'string'
        ? {
            actionType: actionTypeOrPayload,
            target: target || '-',
            details,
            metadata,
          }
        : actionTypeOrPayload

    const actor = await resolveCurrentActor()

    const { error } = await supabase.from('system_logs').insert({
      actor_user_id: actor.actorUserId,
      user_name: actor.userName,
      user_email: actor.userEmail,
      user_department: actor.userDepartment,
      action_type: payload.actionType,
      target_resource: payload.target,
      module: payload.module || null,
      details: payload.details || '',
      metadata: payload.metadata || {},
    })

    if (error) {
      console.error('日誌寫入失敗:', error)
    }
  } catch (err) {
    console.error('Logger Error:', err)
  }
}