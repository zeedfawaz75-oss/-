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