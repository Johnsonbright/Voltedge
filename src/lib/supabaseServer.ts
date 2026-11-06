import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { AuthUser, CustomerProfile } from './authTypes';
import { getServiceSupabase } from './supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isServerSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project')
);

export async function createSupabaseServerClient() {
  if (!isServerSupabaseConfigured) return null;

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies; proxy refreshes them on requests.
        }
      },
    },
  });
}

function readAuthUser(claims: Record<string, unknown>): AuthUser | null {
  if (typeof claims.sub !== 'string') return null;

  const rawMetadata = claims.user_metadata;
  const userMetadata: Record<string, string> = {};
  if (rawMetadata && typeof rawMetadata === 'object') {
    for (const [key, value] of Object.entries(rawMetadata)) {
      if (typeof value === 'string') userMetadata[key] = value;
    }
  }

  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    user_metadata: userMetadata,
  };
}

export interface ServerAuthState {
  user: AuthUser | null;
  profile: CustomerProfile | null;
  error: string | null;
}

export const getServerAuthState = cache(async (): Promise<ServerAuthState> => {
  const client = await createSupabaseServerClient();
  if (!client) return { user: null, profile: null, error: null };

  const { data, error: claimsError } = await client.auth.getClaims();
  const user = data?.claims ? readAuthUser(data.claims as Record<string, unknown>) : null;
  if (claimsError) {
    return {
      user: null,
      profile: null,
      error: 'Unable to verify your sign-in session.',
    };
  }
  if (!user) return { user: null, profile: null, error: null };

  const database = getServiceSupabase();
  if (!database) {
    return { user, profile: null, error: 'Server-side profile access is not configured.' };
  }

  const { data: profile, error: profileError } = await database
    .from('profiles')
    .select('id, name, email, phone, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return { user, profile: null, error: 'Unable to load your account profile.' };
  }

  return { user, profile: profile as CustomerProfile | null, error: null };
});

export async function syncProfileForUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const database = getServiceSupabase();
  if (!database) throw new Error('Server-side profile access is not configured.');

  const fullName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    '';
  const phone =
    typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : '';

  const { data: existing, error: readError } = await database
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) throw new Error('Unable to check your account profile.');

  const profileWrite = existing
    ? database
        .from('profiles')
        .update({ email: user.email || '' })
        .eq('id', user.id)
    : database.from('profiles').insert({
        id: user.id,
        name: fullName,
        email: user.email || '',
        phone,
      });

  const { error: writeError } = await profileWrite;
  if (writeError) throw new Error('Unable to initialize your account profile.');

  const bootstrapEmail = process.env.SUPER_ADMIN_EMAIL?.trim();
  if (bootstrapEmail && user.email) {
    const { error: bootstrapError } = await database.rpc('bootstrap_voltedge_super_admin', {
      target_user_id: user.id,
      target_email: user.email,
      bootstrap_email: bootstrapEmail,
    });
    if (bootstrapError) throw new Error('Unable to apply initial administrator setup.');
  }
}
