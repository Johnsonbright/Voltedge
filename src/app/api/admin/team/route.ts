import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';

export async function GET() {
  const access = await requireSuperAdmin();
  if (!access.authorized) return access.response;

  const { data, error } = await access.database
    .from('profiles')
    .select('id, name, email, role, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ success: false, message: 'Unable to load team accounts.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, users: data });
}

export async function PATCH(req: NextRequest) {
  const access = await requireSuperAdmin();
  if (!access.authorized) return access.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = z.object({
    user_id: z.string().uuid(),
    role: z.enum(['customer', 'admin']),
  }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'A valid account and customer/admin role are required.' },
      { status: 400 }
    );
  }
  if (parsed.data.user_id === access.user.id) {
    return NextResponse.json(
      { success: false, message: 'You cannot change your own super administrator role.' },
      { status: 409 }
    );
  }

  const { data: target, error: readError } = await access.database
    .from('profiles')
    .select('id, role')
    .eq('id', parsed.data.user_id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ success: false, message: 'Unable to load the account.' }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ success: false, message: 'Account not found.' }, { status: 404 });
  }
  if (target.role === 'super_admin') {
    return NextResponse.json(
      { success: false, message: 'A super administrator cannot be changed through this action.' },
      { status: 409 }
    );
  }

  const { error } = await access.database
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.user_id);
  if (error) {
    return NextResponse.json({ success: false, message: 'Unable to update account role.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
