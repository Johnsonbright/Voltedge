'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace('/');
  }, [isAdmin, loading, router, user]);

  if (loading || !user || !isAdmin) return null;

  const navItems = [
    { href: '/admin', label: 'Orders' },
    { href: '/admin/products', label: 'Products' },
    { href: '/admin/customers', label: 'Customers' },
    ...(profile.role === 'super_admin'
      ? [
          { href: '/admin/team', label: 'Team' },
          { href: '/admin/integrations', label: 'Integrations' },
        ]
      : []),
  ];

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      await signOut();
      router.replace('/');
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                pathname === item.href
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-900 text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
      {signOutError && <p role="alert" className="text-sm text-rose-300">{signOutError}</p>}
      {children}
    </div>
  );
}
