import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/lib/adminAuth';

const cartSchema = z.object({
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().min(1).max(99),
    })
  ).max(50),
});

export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access.authorized) return access.response;

  const { data: profile, error } = await access.database
    .from('profiles')
    .select('cart_items')
    .eq('id', access.user.id)
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, message: 'Unable to load your saved cart.' },
      { status: 500 }
    );
  }

  const savedItems = Array.isArray(profile.cart_items) ? profile.cart_items : [];
  const ids = savedItems
    .map((item: { product_id?: unknown }) => item.product_id)
    .filter((id: unknown): id is string => typeof id === 'string');
  if (ids.length === 0) return NextResponse.json({ success: true, items: [] });

  const { data: products, error: productsError } = await access.database
    .from('products')
    .select('*')
    .in('id', ids)
    .eq('is_active', true);

  if (productsError) {
    return NextResponse.json(
      { success: false, message: 'Unable to load products from your saved cart.' },
      { status: 500 }
    );
  }

  const productById = new Map((products || []).map((product) => [product.id, product]));
  const items = savedItems.flatMap((item: { product_id?: unknown; quantity?: unknown }) => {
    const product = typeof item.product_id === 'string' ? productById.get(item.product_id) : null;
    if (!product || typeof item.quantity !== 'number' || !Number.isInteger(item.quantity)) return [];
    return [{ product, quantity: item.quantity }];
  });

  return NextResponse.json({ success: true, items });
}

export async function PUT(req: NextRequest) {
  const access = await requireAuthenticatedUser();
  if (!access.authorized) return access.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = cartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Cart contains invalid items.', errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const productIds = [...new Set(parsed.data.items.map((item) => item.product_id))];
  if (productIds.length !== parsed.data.items.length) {
    return NextResponse.json(
      { success: false, message: 'Cart items must contain each product only once.' },
      { status: 400 }
    );
  }

  if (productIds.length > 0) {
    const { data: products, error } = await access.database
      .from('products')
      .select('id')
      .in('id', productIds)
      .eq('is_active', true);
    if (error || products?.length !== productIds.length) {
      return NextResponse.json(
        { success: false, message: 'One or more cart products are no longer available.' },
        { status: 409 }
      );
    }
  }

  const { error } = await access.database
    .from('profiles')
    .update({
      cart_items: parsed.data.items.map(({ product_id, quantity }) => ({ product_id, quantity })),
    })
    .eq('id', access.user.id);
  if (error) {
    return NextResponse.json(
      { success: false, message: 'Unable to save your cart to your account.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
