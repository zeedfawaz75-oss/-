
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX shops_phone_unique ON public.shops (phone);
CREATE UNIQUE INDEX shops_name_unique ON public.shops (lower(name));
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
