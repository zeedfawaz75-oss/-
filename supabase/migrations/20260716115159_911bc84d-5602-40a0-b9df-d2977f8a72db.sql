
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
