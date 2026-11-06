import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  const access = await requireAdmin();
  if (!access.authorized) return access.response;

  const label = req.nextUrl.searchParams.get('label');
  let query = access.database
    .from('profiles')
    .select('id, name, email, phone, role, lifecycle_label, created_at')
    .order('created_at', { ascending: false });
  if (label && label !== 'ALL') query = query.eq('lifecycle_label', label);

  const { data: profiles, error } = await query;
  if (error) {
    return NextResponse.json(
      { success: false, message: 'Unable to load customer profiles.' },
      { status: 500 }
    );
  }
  const profileIds = (profiles || []).map((profile) => profile.id);
  const { data: tags, error: tagError } = profileIds.length
    ? await access.database
        .from('customer_tags')
        .select('id, user_id, tag, created_at')
        .in('user_id', profileIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null };
  if (tagError) {
    return NextResponse.json(
      { success: false, message: 'Unable to load customer tags.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    customers: (profiles || []).map((profile) => ({
      ...profile,
      tags: (tags || []).filter((tag) => tag.user_id === profile.id),
    })),
  });
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
  const parsed = z.object({
    user_id: z.string().uuid(),
    tag: z.string().trim().min(1).max(64),
  }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Enter a customer and a tag of 1–64 characters.' },
      { status: 400 }
    );
  }

  const { data, error } = await access.database
    .from('customer_tags')
    .upsert(
      { user_id: parsed.data.user_id, tag: parsed.data.tag, created_by: access.user.id },
      { onConflict: 'user_id,tag', ignoreDuplicates: true }
    )
    .select('id, user_id, tag, created_at')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ success: false, message: 'Unable to add customer tag.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, tag: data });
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
  const parsed = z.object({ id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: 'A valid tag ID is required.' }, { status: 400 });
  }

  const { error } = await access.database.from('customer_tags').delete().eq('id', parsed.data.id);
  if (error) {
    return NextResponse.json({ success: false, message: 'Unable to remove customer tag.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
