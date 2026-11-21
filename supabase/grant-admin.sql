-- Synthetic email for the phone-based admin account (718667758).
-- Run this only after applying the project migrations.
do $$
declare
  target_email text := '718667758@marib-dir.com';
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = lower(target_email);

  if target_user_id is null then
    raise exception 'No Auth user found for %; sign up first.', target_email;
  end if;

  insert into public.user_roles (user_id, role)
  values (target_user_id, 'admin')
  on conflict (user_id, role) do nothing;
end;
$$;

select u.email, r.role
from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role = 'admin'
order by u.email;
