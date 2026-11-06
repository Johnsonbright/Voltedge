'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { AuthUser, CustomerProfile } from '@/lib/authTypes';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

interface AuthContextType {
  user: AuthUser | null;
  profile: CustomerProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
  accessToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toAuthUser(user: User): AuthUser {
  const userMetadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(user.user_metadata || {})) {
    if (typeof value === 'string') userMetadata[key] = value;
  }
  return { id: user.id, email: user.email || null, user_metadata: userMetadata };
}

export function AuthProvider({
  children,
  initialUser,
  initialProfile,
  initialError,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
  initialProfile: CustomerProfile | null;
  initialError: string | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [profile, setProfile] = useState<CustomerProfile | null>(initialProfile);
  const [authError, setAuthError] = useState<string | null>(initialError);

  useEffect(() => {
    if (!supabaseBrowser) return;

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setProfile(null);
        setAuthError(null);
        return;
      }

      setUser(toAuthUser(session.user));
      setAuthError(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async (redirectPath = '/') => {
    if (!supabaseBrowser) throw new Error('Supabase authentication is not configured.');
    const requestedUrl = new URL(redirectPath, window.location.origin);
    const safeRedirectPath =
      requestedUrl.origin === window.location.origin
        ? `${requestedUrl.pathname}${requestedUrl.search}${requestedUrl.hash}`
        : '/';
    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', safeRedirectPath);
    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseBrowser) return;
    const { error } = await supabaseBrowser.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
  }, []);

  const accessToken = useCallback(async () => {
    if (!supabaseBrowser) return null;
    const { data, error } = await supabaseBrowser.auth.getSession();
    if (error) throw error;
    return data.session?.access_token ?? null;
  }, []);

  const refreshProfile = useCallback(async () => {
    const response = await fetch('/api/auth/profile', { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Unable to refresh your account profile.');
    }
    setProfile(data.profile as CustomerProfile);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      loading: false,
      authError,
      signInWithGoogle,
      signOut,
      accessToken,
      refreshProfile,
    }),
    [accessToken, authError, profile, refreshProfile, signInWithGoogle, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
