import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/adminAuth';

export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access.authorized) return access.response;

  return NextResponse.json({ success: true, profile: access.profile });
}
