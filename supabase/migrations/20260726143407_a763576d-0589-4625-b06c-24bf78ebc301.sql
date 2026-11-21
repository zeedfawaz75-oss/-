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