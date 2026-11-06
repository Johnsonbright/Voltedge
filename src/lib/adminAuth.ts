import { NextResponse } from 'next/server';
import type { AuthUser, CustomerProfile } from './authTypes';
import { createSupabaseServerClient } from './supabaseServer';
import { getServiceSupabase } from './supabaseAdmin';

type ServiceDatabase = NonNullable<ReturnType<typeof getServiceSupabase>>;

export type AuthenticatedAccess =
  | {
      authorized: true;
      user: AuthUser;
      profile: CustomerProfile;
      database: ServiceDatabase;
    }
  | { authorized: false; response: NextResponse };

export type AdminAccess =
  | {
      authorized: true;
      user: AuthUser;
      role: 'admin' | 'super_admin';
      database: ServiceDatabase;
    }
  | { authorized: false; response: NextResponse };

type OptionalAccess =
  | {
      authorized: true;
      user: AuthUser | null;
      profile: CustomerProfile | null;
      database: ServiceDatabase | null;
    }
  | { authorized: false; response: NextResponse };

function unauthorized(message: string, status: number): AuthenticatedAccess {
  return {
    authorized: false,
    response: NextResponse.json({ success: false, message }, { status }),
  };
}

async function authenticatedAccessForClaims(
  claims: Record<string, unknown>
): Promise<AuthenticatedAccess> {
  if (typeof claims.sub !== 'string') {
    return unauthorized('Sign in is required or your session has expired.', 401);
  }
  const database = getServiceSupabase();
  if (!database) {
    return unauthorized('Server-side Supabase access is not configured.', 503);
  }

  const { data: profile, error: profileError } = await database
    .from('profiles')
    .select('id, name, email, phone, role')
    .eq('id', claims.sub)
    .maybeSingle();

  if (profileError) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, message: 'Unable to verify your account profile.' },
        { status: 500 }
      ),
    };
  }
  if (!profile) {
    return unauthorized('Your account profile is not available.', 403);
  }

  const metadata: Record<string, string> = {};
  const rawMetadata = claims.user_metadata;
  if (rawMetadata && typeof rawMetadata === 'object') {
    for (const [key, value] of Object.entries(rawMetadata)) {
      if (typeof value === 'string') metadata[key] = value;
    }
  }

  return {
    authorized: true,
    user: {
      id: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      user_metadata: metadata,
    },
    profile: profile as CustomerProfile,
    database,
  };
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedAccess> {
  const client = await createSupabaseServerClient();
  if (!client) return unauthorized('Supabase authentication is not configured.', 503);

  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims) {
    return unauthorized('Sign in is required or your session has expired.', 401);
  }
  return authenticatedAccessForClaims(data.claims as Record<string, unknown>);
}

export async function requireAdmin(): Promise<AdminAccess> {
  const access = await requireAuthenticatedUser();
  if (!access.authorized) return access;
  if (access.profile.role !== 'admin' && access.profile.role !== 'super_admin') {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, message: 'Administrator access is required.' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user: access.user,
    role: access.profile.role,
    database: access.database,
  };
}

export async function requireSuperAdmin(): Promise<AdminAccess> {
  const access = await requireAdmin();
  if (!access.authorized) return access;
  if (access.role !== 'super_admin') {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, message: 'Super administrator access is required.' },
        { status: 403 }
      ),
    };
  }
  return access;
}

export async function requireOptionalAuthenticatedUser(): Promise<OptionalAccess> {
  const client = await createSupabaseServerClient();
  if (!client) return { authorized: true, user: null, profile: null, database: getServiceSupabase() };

  const { data, error } = await client.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== 'string') {
    return { authorized: true, user: null, profile: null, database: getServiceSupabase() };
  }

  const required = await authenticatedAccessForClaims(claims as Record<string, unknown>);
  if (!required.authorized) return required;
  return { ...required, authorized: true };
}
