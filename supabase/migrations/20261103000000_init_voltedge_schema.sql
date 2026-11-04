-- VoltEdge Electronics Database Schema
-- Supabase Migration: 20261103000000_init_voltedge_schema.sql

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for products updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 2. ORDERS TABLE
-- Note: The website NEVER writes directly to this table.
-- n8n uses the Supabase service role key to insert and manage orders.
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_ref TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT,
    delivery_notes TEXT,
    total NUMERIC(14, 2) NOT NULL CHECK (total >= 0),
    bonus_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (bonus_amount >= 0),
    bonus_status TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE', -- 'NOT_ELIGIBLE', 'PENDING_VERIFICATION', 'ACTIVATED', 'REJECTED'
    payment_status TEXT NOT NULL DEFAULT 'UNPAID',    -- 'UNPAID', 'PENDING_VERIFICATION', 'VERIFIED', 'FAILED'
    order_status TEXT NOT NULL DEFAULT 'PENDING',      -- 'PENDING', 'UNDER_REVIEW', 'CONFIRMED', 'CANCELLED', 'REJECTED'
    tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],         -- e.g. {'HIGH_VALUE', 'OVER_STOCK', 'REVIEW_REQUIRED', 'PROMO_APPLIED'}
    review_reasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[], -- e.g. {'STOCK_EXCEEDED: Sony WH-1000XM5 requested 4, stock 2'}
    idempotency_key TEXT UNIQUE NOT NULL,
    customer_type TEXT NOT NULL DEFAULT 'STANDARD',    -- 'STANDARD', 'VIP', 'RETURNING'
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 3. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_ref ON public.orders(order_ref);
CREATE INDEX IF NOT EXISTS idx_orders_tags ON public.orders USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON public.orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Products RLS: Readable by anon role for active items
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Orders RLS: NO anon access.
-- Anon users CANNOT query orders or order_items directly.
-- Tracking happens via protected server API route with server-side validation.
-- Authenticated users (admin) can read orders.
DROP POLICY IF EXISTS "Deny anon access to orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated admin can view orders" ON public.orders;
CREATE POLICY "Authenticated admin can view orders"
ON public.orders
FOR SELECT
TO authenticated
USING (true);

-- Order Items RLS: Authenticated users can view
DROP POLICY IF EXISTS "Authenticated admin can view order_items" ON public.order_items;
CREATE POLICY "Authenticated admin can view order_items"
ON public.order_items
FOR SELECT
TO authenticated
USING (true);
