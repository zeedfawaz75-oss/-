-- Quick admin/user check for Supabase Dashboard

-- 1) View users
select id, email, phone, created_at
from auth.users
order by created_at desc
limit 20;

-- 2) View all role assignments
select user_id, role
from public.user_roles
order by user_id
limit 50;

-- 3) View admin users only
select user_id, role
from public.user_roles
where role = 'admin';

-- 4) Check if current signed-in user is admin
select public.has_role(auth.uid(), 'admin');

-- 5) View recent shops
select *
from public.shops
order by created_at desc
limit 20;

-- 6) View recent notifications
select *
from public.notifications
order by created_at desc
limit 20;

-- 7) View auth metadata for recent users
select id, email, phone, raw_user_meta_data
from auth.users
order by created_at desc
limit 10;
