-- 新增成員待審核欄位
-- 用於標記剛申請、尚未由管理員指派權限的帳號

alter table public.members
  add column if not exists is_pending_approval boolean not null default false;

update public.members
set is_pending_approval = true,
    status = 'PendingApproval'
where coalesce(is_admin, false) = false
  and (
    permissions is null
    or jsonb_typeof(to_jsonb(permissions)) = 'array' and array_length(permissions, 1) is null
  );
