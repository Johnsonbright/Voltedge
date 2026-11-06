import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, syncProfileForUser } from '@/lib/supabaseServer';

function getSafeRedirectPath(value: string | null, origin: string) {
  if (!value) return '/';
  const requestedUrl = new URL(value, origin);
  return requestedUrl.origin === origin
    ? `${requestedUrl.pathname}${requestedUrl.search}${requestedUrl.hash}`
    : '/';
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json(
      { success: false, message: 'Google sign-in did not return an authorization code.' },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Supabase authentication is not configured.' },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.json(
      { success: false, message: 'Unable to complete Google sign-in.' },
      { status: 401 }
    );
  }

  try {
    await syncProfileForUser(data.user);
  } catch (syncError) {
    return NextResponse.json(
      {
        success: false,
        message:
          syncError instanceof Error
            ? syncError.message
            : 'Unable to initialize your account profile.',
      },
      { status: 500 }
    );
  }

  return NextResponse.redirect(
    new URL(
      getSafeRedirectPath(request.nextUrl.searchParams.get('next'), request.nextUrl.origin),
      request.nextUrl.origin
    )
  );
}
