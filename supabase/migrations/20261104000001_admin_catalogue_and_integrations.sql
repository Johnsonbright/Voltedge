-- VoltEdge hosted Supabase additions: identity, customer lifecycle, admin RBAC,
-- product image storage, and order/integration settings.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'admin', 'super_admin')),
  lifecycle_label TEXT NOT NULL DEFAULT 'PROSPECT'
    CHECK (lifecycle_label IN (
      'PROSPECT', 'INTERESTED', 'LEAD', 'CUSTOMER',
      'RETURNING_CUSTOMER', 'VIP_CUSTOMER'
    )),
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(cart_items) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE public.orders
  ALTER COLUMN payment_status SET DEFAULT 'PAYMENT_PENDING';
ALTER TABLE public.orders
  ALTER COLUMN order_status SET DEFAULT 'PAYMENT_PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique
  ON public.orders (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_lifecycle_label ON public.profiles (lifecycle_label);

UPDATE public.orders
SET payment_status = CASE
  WHEN payment_status IN ('VERIFIED', 'PAYMENT_CONFIRMED') THEN 'PAYMENT_CONFIRMED'
  ELSE 'PAYMENT_PENDING'
END;

UPDATE public.orders
SET order_status = CASE
  WHEN order_status = 'PENDING' THEN 'PAYMENT_PENDING'
  WHEN order_status = 'UNDER_REVIEW' THEN 'REVIEW_REQUIRED'
  ELSE order_status
END;

UPDATE public.orders
SET tags = array_remove(array_replace(tags, 'HIGH_VALUE', 'HIGH_VALUE_ORDER'), 'PROMO_APPLIED');

UPDATE public.orders
SET tags = array_append(tags, 'PAYMENT_CONFIRMED')
WHERE payment_status = 'PAYMENT_CONFIRMED'
  AND NOT ('PAYMENT_CONFIRMED' = ANY(tags));

UPDATE public.orders
SET tags = array_append(tags, 'PAYMENT_PENDING')
WHERE payment_status = 'PAYMENT_PENDING'
  AND NOT ('PAYMENT_PENDING' = ANY(tags));

UPDATE public.orders
SET tags = array_append(tags, 'STANDARD_ORDER')
WHERE NOT ('HIGH_VALUE_ORDER' = ANY(tags))
  AND NOT ('INCOMPLETE_ORDER' = ANY(tags))
  AND NOT ('STANDARD_ORDER' = ANY(tags));

CREATE TABLE IF NOT EXISTS public.customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (length(trim(tag)) BETWEEN 1 AND 64),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_customer_tags_user_id ON public.customer_tags (user_id);

CREATE TABLE IF NOT EXISTS public.store_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vip_minimum_spend NUMERIC(14, 2) NOT NULL DEFAULT 5000000
    CHECK (vip_minimum_spend >= 0),
  vip_minimum_paid_orders INTEGER NOT NULL DEFAULT 3
    CHECK (vip_minimum_paid_orders >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.integration_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  webhook_url TEXT,
  test_webhook_url TEXT,
  environment TEXT NOT NULL DEFAULT 'test'
    CHECK (environment IN ('test', 'production')),
  webhook_secret TEXT,
  mock_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_voltedge_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_voltedge_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.set_voltedge_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_voltedge_updated_at();

DROP TRIGGER IF EXISTS set_integration_settings_updated_at ON public.integration_settings;
CREATE TRIGGER set_integration_settings_updated_at
BEFORE UPDATE ON public.integration_settings
FOR EACH ROW EXECUTE FUNCTION public.set_voltedge_updated_at();

DROP TRIGGER IF EXISTS set_store_settings_updated_at ON public.store_settings;
CREATE TRIGGER set_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.set_voltedge_updated_at();

CREATE OR REPLACE FUNCTION public.create_voltedge_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE
  SET name = CASE WHEN public.profiles.name = '' THEN EXCLUDED.name ELSE public.profiles.name END,
      email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_voltedge ON auth.users;
CREATE TRIGGER on_auth_user_created_voltedge
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_voltedge_profile();

CREATE OR REPLACE FUNCTION public.bootstrap_voltedge_super_admin(
  target_user_id UUID,
  target_email TEXT,
  bootstrap_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF COALESCE(
     NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'role',
     current_setting('request.jwt.claim.role', true)
   ) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF bootstrap_email IS NULL OR lower(trim(target_email)) <> lower(trim(bootstrap_email)) THEN
    RETURN false;
  END IF;

  LOCK TABLE public.profiles IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin') THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET role = 'super_admin'
  WHERE id = target_user_id AND lower(email) = lower(trim(bootstrap_email));
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_voltedge_super_admin(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_voltedge_super_admin(UUID, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_voltedge_lifecycle(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_email TEXT;
  order_count BIGINT;
  confirmed_count BIGINT;
  confirmed_spend NUMERIC(14, 2);
  has_cart BOOLEAN;
  vip_spend NUMERIC(14, 2);
  vip_orders INTEGER;
  next_label TEXT;
BEGIN
  SELECT email, jsonb_array_length(cart_items) > 0
    INTO target_email, has_cart
  FROM public.profiles
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE payment_status IN ('PAYMENT_CONFIRMED', 'VERIFIED')),
         COALESCE(sum(total) FILTER (WHERE payment_status IN ('PAYMENT_CONFIRMED', 'VERIFIED')), 0)
    INTO order_count, confirmed_count, confirmed_spend
  FROM public.orders
  WHERE user_id = target_user_id
     OR (user_id IS NULL AND lower(customer_email) = lower(target_email));

  SELECT vip_minimum_spend, vip_minimum_paid_orders
    INTO vip_spend, vip_orders
  FROM public.store_settings
  WHERE id = 1;
  vip_spend := COALESCE(vip_spend, 5000000);
  vip_orders := COALESCE(vip_orders, 3);

  next_label := CASE
    WHEN confirmed_spend >= vip_spend OR confirmed_count >= vip_orders THEN 'VIP_CUSTOMER'
   WHEN confirmed_count >= 2 THEN 'RETURNING_CUSTOMER'
    WHEN confirmed_count >= 1 THEN 'CUSTOMER'
    WHEN order_count >= 1 THEN 'LEAD'
    WHEN has_cart THEN 'INTERESTED'
    ELSE 'PROSPECT'
  END;

  UPDATE public.profiles
  SET lifecycle_label = next_label
  WHERE id = target_user_id AND lifecycle_label IS DISTINCT FROM next_label;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_lifecycle_for_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected_user_id UUID;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.user_id IS NOT NULL THEN
      PERFORM public.refresh_voltedge_lifecycle(OLD.user_id);
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    affected_user_id := NEW.user_id;
    IF affected_user_id IS NULL THEN
      SELECT id INTO affected_user_id
      FROM public.profiles
      WHERE lower(email) = lower(NEW.customer_email)
      LIMIT 1;
    END IF;
    IF affected_user_id IS NOT NULL THEN
      PERFORM public.refresh_voltedge_lifecycle(affected_user_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_lifecycle_after_order ON public.orders;
CREATE TRIGGER refresh_lifecycle_after_order
AFTER INSERT OR UPDATE OR DELETE
ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.refresh_lifecycle_for_order();

CREATE OR REPLACE FUNCTION public.refresh_lifecycle_after_cart_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.refresh_voltedge_lifecycle(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_lifecycle_after_cart_change ON public.profiles;
CREATE TRIGGER refresh_lifecycle_after_cart_change
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.refresh_lifecycle_after_cart_change();

CREATE OR REPLACE FUNCTION public.refresh_lifecycles_after_vip_settings_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  profile_id UUID;
BEGIN
  FOR profile_id IN SELECT id FROM public.profiles LOOP
    PERFORM public.refresh_voltedge_lifecycle(profile_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_lifecycles_after_vip_settings_change ON public.store_settings;
CREATE TRIGGER refresh_lifecycles_after_vip_settings_change
AFTER UPDATE OF vip_minimum_spend, vip_minimum_paid_orders ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.refresh_lifecycles_after_vip_settings_change();

DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Authenticated admin can view orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated admin can view order_items" ON public.order_items;
DROP POLICY IF EXISTS "Customers read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Customers update own contact profile" ON public.profiles;
DROP POLICY IF EXISTS "Customers read own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins read all orders" ON public.orders;
DROP POLICY IF EXISTS "Customers read own order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins read all order items" ON public.order_items;

CREATE POLICY "Public can view active products"
ON public.products FOR SELECT TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Customers read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Customers update own contact profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Customers read own orders"
ON public.orders FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins read all orders"
ON public.orders FOR SELECT TO authenticated
USING (public.is_voltedge_admin());

CREATE POLICY "Customers read own order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Admins read all order items"
ON public.order_items FOR SELECT TO authenticated
USING (public.is_voltedge_admin());

REVOKE ALL ON public.profiles, public.customer_tags, public.store_settings,
  public.integration_settings, public.products, public.orders, public.order_items
FROM anon, authenticated;
GRANT ALL ON public.profiles, public.customer_tags, public.store_settings,
  public.integration_settings, public.products, public.orders, public.order_items
TO service_role;
GRANT SELECT (id, name, email, phone, role) ON public.profiles TO authenticated;
GRANT SELECT ON public.products, public.orders, public.order_items TO authenticated;
GRANT UPDATE (name, phone) ON public.profiles TO authenticated;
GRANT SELECT ON public.products TO anon;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete product images" ON storage.objects;

CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Admins upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.is_voltedge_admin());

CREATE POLICY "Admins update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.is_voltedge_admin())
WITH CHECK (bucket_id = 'product-images' AND public.is_voltedge_admin());

CREATE POLICY "Admins delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.is_voltedge_admin());

REVOKE ALL ON public.customer_tags, public.store_settings, public.integration_settings FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_voltedge_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_voltedge_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_voltedge_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_voltedge_super_admin() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.refresh_voltedge_lifecycle(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_voltedge_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_lifecycle_for_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_lifecycle_after_cart_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_lifecycles_after_vip_settings_change() FROM PUBLIC, anon, authenticated;

-- Keep public reads limited to active products; all writes use the server-only service role.
REVOKE INSERT, UPDATE, DELETE ON public.products, public.orders, public.order_items FROM anon, authenticated;
