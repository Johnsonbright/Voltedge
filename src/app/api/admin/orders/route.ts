import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET() {
  const access = await requireAdmin();
  if (!access.authorized) return access.response;

  const { data: orders, error } = await access.database
    .from('orders')
    .select('*, order_items (*)')
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve admin orders.', error: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, orders: orders || [] });
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

  const parsed = z.object({ order_ref: z.string().trim().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'A valid order reference is required.' },
      { status: 400 }
    );
  }

  const { data: order, error: readError } = await access.database
    .from('orders')
    .select('id, tags')
    .eq('order_ref', parsed.data.order_ref.toUpperCase())
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ success: false, message: 'Unable to load the order.' }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
  }

  const tags = (order.tags || []).filter((tag: string) => tag !== 'PAYMENT_PENDING');
  if (!tags.includes('PAYMENT_CONFIRMED')) tags.push('PAYMENT_CONFIRMED');
  const { data, error } = await access.database
    .from('orders')
    .update({ payment_status: 'PAYMENT_CONFIRMED', tags })
    .eq('id', order.id)
    .select('*, order_items (*)')
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, message: 'Unable to verify payment for this order.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    order: data,
    message: 'Payment marked as verified. Any eligible bonus remains subject to workflow processing.',
  });
}
