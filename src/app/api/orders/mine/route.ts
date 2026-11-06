import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/adminAuth';

export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access.authorized) return access.response;

  const { data: linkedOrders, error: linkedError } = await access.database
    .from('orders')
    .select('*, order_items (*)')
    .eq('user_id', access.user.id)
    .order('created_at', { ascending: false });

  if (linkedError) {
    return NextResponse.json(
      { success: false, message: 'Unable to load your orders.' },
      { status: 500 }
    );
  }

  const { data: legacyOrders, error: legacyError } = await access.database
    .from('orders')
    .select('*, order_items (*)')
    .is('user_id', null)
    .ilike('customer_email', access.user.email || '')
    .order('created_at', { ascending: false });

  if (legacyError) {
    return NextResponse.json(
      { success: false, message: 'Unable to load your older orders.' },
      { status: 500 }
    );
  }

  const orders = [...(linkedOrders || []), ...(legacyOrders || [])]
    .filter((order, index, list) => list.findIndex((entry) => entry.id === order.id) === index)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((order) => {
      const customerOrder = { ...order };
      delete customerOrder.raw_payload;
      delete customerOrder.idempotency_key;
      delete customerOrder.tags;
      delete customerOrder.customer_type;
      return customerOrder;
    });

  return NextResponse.json({ success: true, orders });
}
