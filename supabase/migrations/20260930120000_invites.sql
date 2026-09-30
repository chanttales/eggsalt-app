-- Invites: an owner adds someone by email; when that person signs in with the same (verified)
-- email, accept_invites() makes them a member of the workspace. For now every member has the same
-- access as the owner, so invites are made with role 'owner'.
create table invite (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspace(id) on delete cascade,
  email         text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role          member_role not null default 'owner',
  invited_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users(id) on delete set null
);
create unique index invite_open_email_idx on invite (workspace_id, email) where accepted_at is null;
create index invite_email_idx on invite (email) where accepted_at is null;

alter table invite enable row level security;
create policy invite_read on invite for select using (is_member(workspace_id));
create policy invite_owner_insert on invite for insert
  with check (is_owner(workspace_id) and accepted_at is null and invited_by = (select auth.uid()));
create policy invite_owner_delete on invite for delete
  using (is_owner(workspace_id) and accepted_at is null);

-- Owners can remove other members (never themselves, so a workspace always keeps its owner).
create policy member_owner_delete on member for delete
  using (is_owner(workspace_id) and user_id <> (select auth.uid()));

-- Joins every workspace that invited the signed-in user's email and fills in the user's display name
-- where it is missing, so member lists can show who is who. Called by the app after sign-in;
-- returns how many workspaces were joined.
create function accept_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_name text;
  v_count integer := 0;
  r record;
begin
  if v_user is null then return 0; end if;
  select lower(u.email), coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
    into v_email, v_name
    from auth.users u
   where u.id = v_user and u.email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  update member set display_name = coalesce(v_name, v_email)
   where user_id = v_user and display_name is null;
  for r in select * from invite where email = v_email and accepted_at is null for update loop
    insert into member (workspace_id, user_id, role, display_name)
    values (r.workspace_id, v_user, r.role, coalesce(v_name, v_email))
    on conflict (workspace_id, user_id) do nothing;
    update invite set accepted_at = now(), accepted_by = v_user where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke execute on function accept_invites() from public, anon;
grant execute on function accept_invites() to authenticated;
