import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminAuth';

const productFields = {
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(160),
  price: z.number().finite().nonnegative(),
  stock_quantity: z.number().int().nonnegative(),
  image_url: z.string().trim().min(1).max(1000),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(120),
  is_active: z.boolean(),
};

const createProductSchema = z.object(productFields);
const updateProductSchema = createProductSchema.partial().extend({ id: z.string().uuid() });

export async function GET() {
  const access = await requireAdmin();
  if (!access.authorized) return access.response;

  const { data, error } = await access.database
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, message: 'Unable to load products from Supabase.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, products: data });
}

export async function POST(req: NextRequest) {
  const access = await requireAdmin();
  if (!access.authorized) return access.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Check the product fields and try again.', errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const { data, error } = await access.database
    .from('products')
    .insert(parsed.data)
    .select('*')
    .single();

  if (error) {
    const conflict = error.code === '23505';
    return NextResponse.json(
      { success: false, message: conflict ? 'That product slug already exists.' : 'Unable to add product.' },
      { status: conflict ? 409 : 500 }
    );
  }

  return NextResponse.json({ success: true, product: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const access = await requireAdmin();
  if (!access.authorized) return access.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Check the product fields and try again.', errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id, ...updates } = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, message: 'No product changes were provided.' }, { status: 400 });
  }

  const { data, error } = await access.database
    .from('products')
    .update(updates)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    const conflict = error.code === '23505';
    return NextResponse.json(
      { success: false, message: conflict ? 'That product slug already exists.' : 'Unable to update product.' },
      { status: conflict ? 409 : 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ success: false, message: 'Product not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, product: data });
}

export async function DELETE(req: NextRequest) {
  const access = await requireAdmin();
  if (!access.authorized) return access.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = z.object({ id: z.string().uuid(), permanent: z.boolean().optional() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: 'A valid product ID is required.' }, { status: 400 });
  }

  const { data: product, error: readError } = await access.database
    .from('products')
    .select('id, image_url')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ success: false, message: 'Unable to load product.' }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ success: false, message: 'Product not found.' }, { status: 404 });
  }

  const { data, error } = parsed.data.permanent
    ? await access.database.from('products').delete().eq('id', parsed.data.id).select('id').maybeSingle()
    : await access.database.from('products').update({ is_active: false }).eq('id', parsed.data.id).select('id').maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, message: parsed.data.permanent ? 'Unable to delete product.' : 'Unable to deactivate product.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ success: false, message: 'Product not found.' }, { status: 404 });
  }

  if (parsed.data.permanent) {
    const marker = '/storage/v1/object/public/product-images/';
    const markerIndex = product.image_url.indexOf(marker);
    if (markerIndex >= 0) {
      const objectPath = decodeURIComponent(product.image_url.slice(markerIndex + marker.length));
      const { error: storageError } = await access.database.storage.from('product-images').remove([objectPath]);
      if (storageError) {
        return NextResponse.json(
          { success: false, message: 'Product deleted, but its stored image could not be removed.' },
          { status: 500 }
        );
      }
    }
  }
  return NextResponse.json({ success: true });
}
