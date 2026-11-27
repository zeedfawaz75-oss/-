-- Fresh schema for Supabase project yyvjupgezwzdjhsrzxtb.
-- Run only against the intended new/empty project. This script creates schema and storage buckets; it does not import historical records.

-- Required Supabase Storage buckets.
insert into storage.buckets (id, name, public)
values
  ('shops-images', 'shops-images', true),
  ('banners', 'banners', false)
on conflict (id) do update set public = excluded.public;


-- Source migration: 20260609181651_bc18179c-b006-47b4-bf6e-61c5975661f6.sql

CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sector_id TEXT NOT NULL,
  subsection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  address TEXT,
  rating NUMERIC(2,1) NOT NULL DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
  visits INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX shops_owner_listing_unique
  ON public.shops (owner_id, sector_id, subsection_id, phone, lower(name));
CREATE INDEX shops_status_idx ON public.shops (status);
CREATE INDEX shops_sector_idx ON public.shops (sector_id, subsection_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT ON public.shops TO anon;
GRANT ALL ON public.shops TO service_role;

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved shops
CREATE POLICY "Approved shops are public" ON public.shops
  FOR SELECT USING (status = 'approved');

-- Owners can view their own pending/rejected shops
CREATE POLICY "Owners view own shops" ON public.shops
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

-- Authenticated users can insert (forced pending via trigger)
CREATE POLICY "Authenticated can submit shops" ON public.shops
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

-- Owners can update their own
CREATE POLICY "Owners update own shops" ON public.shops
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Owners can delete their own
CREATE POLICY "Owners delete own shops" ON public.shops
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Trigger: force status='pending' on user inserts; force owner_id; bump updated_at
CREATE OR REPLACE FUNCTION public.shops_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.status := 'pending';
  NEW.visits := 0;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shops_before_insert_trg
BEFORE INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.shops_before_insert();

CREATE OR REPLACE FUNCTION public.shops_touch_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TRIGGER shops_updated_at_trg
BEFORE UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.shops_touch_updated();

-- Prevent regular users from approving themselves (status changes only allowed by service_role / admin)
CREATE OR REPLACE FUNCTION public.shops_before_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status; -- regular users cannot change status; admin uses service_role bypass
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shops_before_update_trg
BEFORE UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.shops_before_update();



-- Source migration: 20260609181701_88de72ae-cf60-47b0-a2a4-a784825eb0c1.sql

ALTER FUNCTION public.shops_touch_updated() SET search_path = public;
ALTER FUNCTION public.shops_before_update() SET search_path = public;



-- Source migration: 20260615025429_56b391e2-5705-4be3-9ded-7d7adef343ae.sql
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS bank_account_number text;


-- Source migration: 20260615025718_81dc980e-59cd-46cf-8b10-3c33fc777b45.sql
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_24_7 boolean NOT NULL DEFAULT false;


-- Source migration: 20260616013046_9bf74cb2-b0a5-4472-9497-80389bbed27d.sql

CREATE OR REPLACE FUNCTION public.prevent_owner_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses this; only block when called as a regular user
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_prevent_owner_status_change ON public.shops;
CREATE TRIGGER shops_prevent_owner_status_change
BEFORE UPDATE ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.prevent_owner_status_change();



-- Source migration: 20260616013052_01d4c6cd-192c-43ab-a19d-7ee11c52ca49.sql

REVOKE EXECUTE ON FUNCTION public.prevent_owner_status_change() FROM PUBLIC, anon, authenticated;



-- Source migration: 20260618180818_4cef1716-7677-4257-be3c-82be4cea9f46.sql
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS map_url text;


-- Source migration: 20260704143902_81f1bcd1-c3cd-4e31-9886-a57b6593b956.sql
-- Ensure Data API grants on shops for authenticated inserts and reads
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT ON public.shops TO anon;
GRANT ALL ON public.shops TO service_role;


-- Source migration: 20260713144115_6bb2ab5b-4fc2-4868-983a-8142dc061978.sql

-- Roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security-definer role checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, anon;

-- Admin policies on shops
DROP POLICY IF EXISTS "Admins can view all shops" ON public.shops;
CREATE POLICY "Admins can view all shops"
  ON public.shops FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all shops" ON public.shops;
CREATE POLICY "Admins can update all shops"
  ON public.shops FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete all shops" ON public.shops;
CREATE POLICY "Admins can delete all shops"
  ON public.shops FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admin to bypass shops_before_update status lock via helper trigger
CREATE OR REPLACE FUNCTION public.shops_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF public.has_role(auth.uid(), 'admin') THEN
      -- admins may change status
      RETURN NEW;
    END IF;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;



-- Source migration: 20260713144138_4e2a2159-0ed2-4ea2-b817-b6c5e8354240.sql

-- Public read on shops-images
DROP POLICY IF EXISTS "Public read shops-images" ON storage.objects;
CREATE POLICY "Public read shops-images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'shops-images');

-- Authenticated users can upload into folder = auth.uid()
DROP POLICY IF EXISTS "Users upload own shops-images" ON storage.objects;
CREATE POLICY "Users upload own shops-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shops-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners can update/delete their own files; admins can do any
DROP POLICY IF EXISTS "Owners update own shops-images" ON storage.objects;
CREATE POLICY "Owners update own shops-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'shops-images'
    AND ((storage.foldername(name))[1] = auth.uid()::text
         OR public.has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS "Owners delete own shops-images" ON storage.objects;
CREATE POLICY "Owners delete own shops-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shops-images'
    AND ((storage.foldername(name))[1] = auth.uid()::text
         OR public.has_role(auth.uid(), 'admin'))
  );


-- Omitted data cleanup migration 20260714190144_1d600a9b-41f5-423b-82ba-c10292f73a8d.sql: it deletes existing shops and is unnecessary for a fresh install.


-- Source migration: 20260716115159_911bc84d-5602-40a0-b9df-d2977f8a72db.sql

-- 1. opening_hours field on shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS opening_hours JSONB;

-- 2. ratings table
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, user_id)
);

GRANT SELECT ON public.ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are public read" ON public.ratings
  FOR SELECT USING (true);
CREATE POLICY "Users insert own rating" ON public.ratings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rating" ON public.ratings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own rating" ON public.ratings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ratings_shop_idx ON public.ratings(shop_id);
CREATE INDEX IF NOT EXISTS ratings_user_idx ON public.ratings(user_id);

-- 3. favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own favorites" ON public.favorites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own favorites" ON public.favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own favorites" ON public.favorites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS favorites_shop_idx ON public.favorites(shop_id);
CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites(user_id);

-- 4. touch updated_at on ratings
CREATE OR REPLACE FUNCTION public.ratings_touch_updated()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS ratings_updated_at ON public.ratings;
CREATE TRIGGER ratings_updated_at BEFORE UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.ratings_touch_updated();

-- 5. recompute shops.rating from ratings AVG
CREATE OR REPLACE FUNCTION public.recompute_shop_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target UUID;
  avg_val NUMERIC;
BEGIN
  target := COALESCE(NEW.shop_id, OLD.shop_id);
  SELECT COALESCE(AVG(rating)::NUMERIC(3,2), 5.0) INTO avg_val
    FROM public.ratings WHERE shop_id = target;
  UPDATE public.shops SET rating = avg_val WHERE id = target;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS ratings_recompute_ins ON public.ratings;
CREATE TRIGGER ratings_recompute_ins AFTER INSERT ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.recompute_shop_rating();
DROP TRIGGER IF EXISTS ratings_recompute_upd ON public.ratings;
CREATE TRIGGER ratings_recompute_upd AFTER UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.recompute_shop_rating();
DROP TRIGGER IF EXISTS ratings_recompute_del ON public.ratings;
CREATE TRIGGER ratings_recompute_del AFTER DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.recompute_shop_rating();



-- Source migration: 20260716115211_006f5690-41a1-40f2-b28a-0bb975d82b52.sql

REVOKE EXECUTE ON FUNCTION public.recompute_shop_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ratings_touch_updated() FROM PUBLIC, anon, authenticated;



-- Source migration: 20260725190808_a5122d64-889c-429d-8c1d-6b74f3c13e98.sql
ALTER TABLE public.shops
  ALTER COLUMN rating TYPE NUMERIC(3,2)
  USING rating::NUMERIC(3,2);



-- Source migration: 20260726143407_a763576d-0589-4625-b06c-24bf78ebc301.sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  shop_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_admins_new_shop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_label TEXT;
BEGIN
  SELECT COALESCE(u.raw_user_meta_data->>'full_name', u.phone, split_part(u.email, '@', 1), 'مستخدم')
    INTO owner_label
  FROM auth.users u WHERE u.id = NEW.owner_id;

  INSERT INTO public.notifications (user_id, type, title, body, shop_id)
  SELECT ur.user_id, 'shop_pending',
         'طلب محل جديد بانتظار الموافقة',
         'المحل: ' || NEW.name || ' — صاحب المحل: ' || COALESCE(owner_label, 'مستخدم'),
         NEW.id
  FROM public.user_roles ur
  WHERE ur.role = 'admin';

  RETURN NEW;
END;
$$;

CREATE TRIGGER shops_notify_admins_after_insert
AFTER INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_shop();

CREATE OR REPLACE FUNCTION public.notify_owner_shop_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, type, title, body, shop_id)
      VALUES (NEW.owner_id, 'shop_approved', 'تم قبول محلك 🎉',
              'تم اعتماد «' || NEW.name || '» ونشره في الدليل.', NEW.id);
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, type, title, body, shop_id)
      VALUES (NEW.owner_id, 'shop_rejected', 'تم رفض طلب محلك',
              'لم يتم اعتماد «' || NEW.name || '». يمكنك التواصل مع الإدارة للمراجعة.', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shops_notify_owner_after_status_update
AFTER UPDATE OF status ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_shop_status();


-- Source migration: 20260726143427_22cf5299-faf2-4f6c-ba67-b6de0b547612.sql
REVOKE ALL ON FUNCTION public.notify_admins_new_shop() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_owner_shop_status() FROM PUBLIC, anon, authenticated;


-- Source migration: 20260727134515_0483440e-589f-4e2a-b00c-9f1e60ca6878.sql
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS author_name text;

CREATE OR REPLACE FUNCTION public.notify_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop_rec RECORD;
  who TEXT;
  snippet TEXT;
BEGIN
  IF NEW.comment IS NULL OR btrim(NEW.comment) = '' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.comment IS NOT DISTINCT FROM OLD.comment THEN
    RETURN NEW;
  END IF;

  SELECT s.id, s.name, s.owner_id INTO shop_rec FROM public.shops s WHERE s.id = NEW.shop_id;
  IF shop_rec.id IS NULL THEN RETURN NEW; END IF;

  who := COALESCE(NULLIF(btrim(NEW.author_name), ''), 'مستخدم');
  snippet := left(NEW.comment, 140);

  INSERT INTO public.notifications (user_id, type, title, body, shop_id)
  SELECT ur.user_id, 'new_review',
         'تعليق جديد على «' || shop_rec.name || '»',
         who || ' (' || NEW.rating || '★): ' || snippet,
         shop_rec.id
  FROM public.user_roles ur
  WHERE ur.role = 'admin' AND ur.user_id <> NEW.user_id;

  IF shop_rec.owner_id IS NOT NULL AND shop_rec.owner_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, shop_id)
    VALUES (shop_rec.owner_id, 'new_review',
            'تعليق جديد على محلك «' || shop_rec.name || '»',
            who || ' (' || NEW.rating || '★): ' || snippet,
            shop_rec.id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_new_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_new_review ON public.ratings;
CREATE TRIGGER trg_notify_new_review
AFTER INSERT OR UPDATE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();

DROP TRIGGER IF EXISTS trg_ratings_touch_updated ON public.ratings;
CREATE TRIGGER trg_ratings_touch_updated
BEFORE UPDATE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.ratings_touch_updated();

DROP TRIGGER IF EXISTS trg_recompute_shop_rating ON public.ratings;
CREATE TRIGGER trg_recompute_shop_rating
AFTER INSERT OR UPDATE OR DELETE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.recompute_shop_rating();


-- Source migration: 20260728140115_7d7c8659-9ec2-41a5-a2c7-8eb7437760ba.sql
-- Categories (sectors + subsections) manageable from the admin dashboard
CREATE TABLE public.categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are public read" ON public.categories
  FOR SELECT USING (true);
CREATE POLICY "Admins insert categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update categories" ON public.categories
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete categories" ON public.categories
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER categories_touch_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.shops_touch_updated();

CREATE INDEX categories_parent_idx ON public.categories(parent_id, sort_order);

-- Banner ads shown on the home page
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  cta_label TEXT,
  target_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active banners are public" ON public.banners
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins view all banners" ON public.banners
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert banners" ON public.banners
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update banners" ON public.banners
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete banners" ON public.banners
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER banners_touch_updated BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.shops_touch_updated();

-- Admins can see and manage roles of all users
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));


-- Source migration: 20260728140230_77d7dc37-c390-46dc-8907-2ffea597af04.sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';


-- Source migration: 20260728140546_1cdffd9f-1be2-49ec-9469-bd5ca3e835d3.sql
CREATE POLICY "Admins manage banner images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));


-- Source migration: 20260730204746_b0415fe0-c0ff-414c-923d-a08b6ea64009.sql
-- 1. Bank details in a protected table
CREATE TABLE IF NOT EXISTS public.shop_bank_details (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  bank_name TEXT,
  bank_account_holder TEXT,
  bank_account_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_bank_details TO authenticated;
GRANT ALL ON public.shop_bank_details TO service_role;
ALTER TABLE public.shop_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own bank details" ON public.shop_bank_details
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners insert own bank details" ON public.shop_bank_details
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners update own bank details" ON public.shop_bank_details
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners delete own bank details" ON public.shop_bank_details
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "Admins manage bank details" ON public.shop_bank_details
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.shops
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_account_holder,
  DROP COLUMN IF EXISTS bank_account_number;

-- 2. Ratings: hide user_id from public reads
DROP POLICY IF EXISTS "Ratings are public read" ON public.ratings;
CREATE POLICY "Users view own rating" ON public.ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE SELECT ON public.ratings FROM anon;

CREATE OR REPLACE VIEW public.public_ratings
WITH (security_invoker = off) AS
  SELECT id, shop_id, rating, comment, author_name, created_at, updated_at
  FROM public.ratings;

GRANT SELECT ON public.public_ratings TO anon, authenticated;

-- 3. Lock down SECURITY DEFINER trigger/helper functions
REVOKE EXECUTE ON FUNCTION public.recompute_shop_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_new_shop() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_owner_shop_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;


-- Source migration: 20260730204808_f291d581-e403-43a6-bca1-a154bb873578.sql
CREATE OR REPLACE VIEW public.public_ratings
WITH (security_invoker = on) AS
  SELECT id, shop_id, rating, comment, author_name, created_at, updated_at
  FROM public.ratings;

GRANT SELECT ON public.public_ratings TO anon, authenticated;

-- Column-level grant: anon can never read user_id
REVOKE SELECT ON public.ratings FROM anon;
GRANT SELECT (id, shop_id, rating, comment, author_name, created_at, updated_at)
  ON public.ratings TO anon;

CREATE POLICY "Ratings readable via public view" ON public.ratings
  FOR SELECT TO anon
  USING (true);


-- Source migration: 20260731175001_d27f553f-834a-4ccf-b275-5d3393d66c7e.sql
DROP POLICY IF EXISTS "Ratings readable via public view" ON public.ratings;

REVOKE ALL ON public.ratings FROM anon;

GRANT SELECT (id, shop_id, rating, comment, author_name, created_at, updated_at) ON public.ratings TO authenticated;

CREATE OR REPLACE VIEW public.public_ratings
WITH (security_invoker = off) AS
  SELECT r.id, r.shop_id, r.rating, r.comment, r.author_name, r.created_at, r.updated_at
  FROM public.ratings r;

GRANT SELECT ON public.public_ratings TO anon, authenticated;


-- Source migration: 20260731175020_5dfa00fe-a41b-4887-9746-d13629195236.sql
CREATE OR REPLACE VIEW public.public_ratings
WITH (security_invoker = on) AS
  SELECT r.id, r.shop_id, r.rating, r.comment, r.author_name, r.created_at, r.updated_at
  FROM public.ratings r;

GRANT SELECT ON public.public_ratings TO anon, authenticated;

REVOKE ALL ON public.ratings FROM anon;
GRANT SELECT (id, shop_id, rating, comment, author_name, created_at, updated_at) ON public.ratings TO anon;

DROP POLICY IF EXISTS "Public can read review content" ON public.ratings;
CREATE POLICY "Public can read review content"
  ON public.ratings FOR SELECT TO anon USING (true);


-- Source migration: 20260901131233_801d6172-3f25-4bd1-96e2-8d90890de9a0.sql
DROP POLICY IF EXISTS "Public can read review content" ON public.ratings;
REVOKE SELECT ON public.ratings FROM anon;
CREATE POLICY "Authenticated can read reviews" ON public.ratings FOR SELECT TO authenticated USING (true);


-- Source migration: 20260901132111_13d6cc03-100d-4f58-a436-05709a3a5b16.sql
DROP POLICY IF EXISTS "Authenticated can read reviews" ON public.ratings;
CREATE POLICY "Users can read their own rating rows"
ON public.ratings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Public review projection; keep ratings.user_id private from all clients.
DROP POLICY IF EXISTS "Ratings are public read" ON public.ratings;
DROP POLICY IF EXISTS "Ratings readable via public view" ON public.ratings;
DROP POLICY IF EXISTS "Public can read review content" ON public.ratings;
DROP POLICY IF EXISTS "Authenticated can read reviews" ON public.ratings;
DROP POLICY IF EXISTS "Users can read their own rating rows" ON public.ratings;
CREATE POLICY "Users can read their own rating rows"
  ON public.ratings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE ALL ON public.ratings FROM anon;
REVOKE SELECT (id, user_id, shop_id, rating, comment, author_name, created_at, updated_at)
  ON public.ratings FROM anon;
CREATE OR REPLACE VIEW public.public_ratings
WITH (security_barrier = true, security_invoker = false) AS
  SELECT id, shop_id, rating, comment, author_name, created_at, updated_at
  FROM public.ratings;
GRANT SELECT ON public.public_ratings TO anon, authenticated;


-- Source migration: 20260901132455_1c81c3a5-90dc-4c44-99a3-cf49b00d573e.sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- A signed-in caller may only check their own roles. Trusted server-side
  -- callers (service role / internal) have a NULL auth.uid() and are allowed.
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;


-- Source migration: 20260904133741_03624838-35b8-4db0-8db2-527d60516aab.sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
END;
$function$;


-- Source migration: 20260913193859_b57c8b39-d6ec-4864-8057-de02c2f42290.sql
CREATE TABLE public.app_legal_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_legal_pages TO anon;
GRANT SELECT ON public.app_legal_pages TO authenticated;
GRANT ALL ON public.app_legal_pages TO service_role;

ALTER TABLE public.app_legal_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Legal pages are public read" ON public.app_legal_pages
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage legal pages" ON public.app_legal_pages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.app_legal_pages_touch_updated()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_legal_pages_touch_updated_trg
BEFORE UPDATE ON public.app_legal_pages
FOR EACH ROW EXECUTE FUNCTION public.app_legal_pages_touch_updated();

-- Authentication security and administrative audit tables
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_attempts_phone_created_idx
  ON public.auth_attempts (phone, created_at DESC);
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.auth_attempts TO service_role;

CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_attempts_phone_created_idx
  ON public.password_reset_attempts (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_attempts_created_idx
  ON public.password_reset_attempts (created_at);
ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.password_reset_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.consume_password_reset_attempt(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recent_attempts INTEGER;
BEGIN
  IF p_phone IS NULL OR length(p_phone) < 8 OR length(p_phone) > 15 THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(52741, hashtext(p_phone));

  DELETE FROM public.password_reset_attempts
  WHERE created_at < now() - interval '30 days';

  SELECT count(*) INTO recent_attempts
  FROM public.password_reset_attempts
  WHERE phone = p_phone
    AND created_at >= now() - interval '15 minutes';

  IF recent_attempts >= 5 THEN
    RETURN false;
  END IF;

  INSERT INTO public.password_reset_attempts (phone) VALUES (p_phone);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_password_reset_attempt(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_password_reset_attempt(TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_security_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_security_audit_created_idx
  ON public.admin_security_audit (created_at DESC);
ALTER TABLE public.admin_security_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.admin_security_audit TO authenticated;
GRANT ALL ON public.admin_security_audit TO service_role;
CREATE POLICY "Admins view security audit"
  ON public.admin_security_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Post-install verification: expected app tables and storage buckets.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'shops', 'user_roles', 'ratings', 'favorites', 'notifications',
    'categories', 'banners', 'shop_bank_details', 'public_ratings',
    'app_legal_pages', 'auth_attempts', 'password_reset_attempts', 'admin_security_audit'
  )
ORDER BY table_name;

SELECT id, name, public
FROM storage.buckets
WHERE id IN ('shops-images', 'banners')
ORDER BY id;