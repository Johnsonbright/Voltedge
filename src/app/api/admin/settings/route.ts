import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';

export async function GET() {
  const access = await requireSuperAdmin();
  if (!access.authorized) return access.response;

  const { data, error } = await access.database
    .from('store_settings')
    .select('vip_minimum_spend, vip_minimum_paid_orders')
    .eq('id', 1)
    .single();
  if (error) {
    return NextResponse.json({ success: false, message: 'Unable to load VIP settings.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, settings: data });
}

export async function PUT(req: NextRequest) {
  const access = await requireSuperAdmin();
  if (!access.authorized) return access.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = z.object({
    vip_minimum_spend: z.number().finite().nonnegative().max(1000000000000),
    vip_minimum_paid_orders: z.number().int().min(1).max(10000),
  }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Enter a valid VIP spend amount and paid-order count.' },
      { status: 400 }
    );
  }

  const { error } = await access.database.from('store_settings').upsert({ id: 1, ...parsed.data });
  if (error) {
    return NextResponse.json({ success: false, message: 'Unable to save VIP settings.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, settings: parsed.data });
}
