-- 1) List all users
select id, email, phone, created_at
from auth.users
order by created_at desc
limit 20;

-- 2) List all role assignments
select user_id, role
from public.user_roles
order by user_id
limit 50;

-- 3) Show admins only
select user_id, role
from public.user_roles
where role = 'admin';

-- 4) Check if current authenticated user has admin access
select public.has_role(auth.uid(), 'admin');

-- 5) List shops from the directory
select *
from public.shops
order by created_at desc
limit 20;

-- 6) List recent notifications
select *
from public.notifications
order by created_at desc
limit 20;

-- 7) If you want to view the exact user metadata
select id, raw_user_meta_data, email, phone
from auth.users
order by created_at desc
limit 10;
