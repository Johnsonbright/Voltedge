'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Zap, Search, ShieldCheck, Menu, X, LogIn, LogOut } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatNaira } from '@/lib/formatters';
import CartDrawer from './CartDrawer';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { itemCount, cartSubtotal, isInitialized } = useCart();
  const { user, profile, authError: profileError, signInWithGoogle, signOut } = useAuth();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to start Google sign-in.');
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      await signOut();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                VoltEdge <span className="text-cyan-400 text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 font-mono">NG</span>
              </span>
              <p className="text-[11px] text-slate-400 font-medium">Premium Electronics • Lagos</p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link href="/" className="text-slate-300 hover:text-cyan-400 transition-colors">
              Catalogue
            </Link>
            <Link href="/track" className="text-slate-300 hover:text-cyan-400 transition-colors flex items-center gap-1.5">
              <Search className="w-4 h-4 text-slate-400" />
              Track Order
            </Link>
            {isAdmin && (
              <Link href="/admin" className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-md bg-slate-900 border border-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Admin Portal
              </Link>
            )}
          </nav>

          {/* Cart Trigger & Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
                title={`Signed in${profile?.name ? ` as ${profile.name}` : ''}. Sign out`}
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-300 hover:border-cyan-500/50 hover:text-white"
              >
                <LogIn className="w-4 h-4" /> Sign in
              </button>
            )}
            <button
              id="cart-drawer-trigger"
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/40 text-white transition-all shadow-sm group"
              aria-label="Open Cart"
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5 text-slate-300 group-hover:text-cyan-400 transition-colors" />
                {isInitialized && itemCount > 0 && (
                  <span className="absolute -top-2 -right-2.5 w-5 h-5 bg-cyan-500 text-slate-950 text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {itemCount}
                  </span>
                )}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Cart</span>
                <span className="text-xs font-semibold text-cyan-300">
                  {isInitialized ? formatNaira(cartSubtotal) : '₦0'}
                </span>
              </div>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {(authError || profileError) && (
          <p role="alert" className="px-4 pb-2 text-xs text-rose-300">{authError || profileError}</p>
        )}

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden px-4 pt-2 pb-4 space-y-2 border-t border-slate-800 bg-slate-950/95">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 text-sm font-medium"
            >
              Catalogue
            </Link>
            <Link
              href="/track"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 text-sm font-medium"
            >
              Track Order
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-sm font-medium"
              >
                Admin Portal
              </Link>
            )}
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleSignOut();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm font-medium"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleGoogleSignIn();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm font-medium"
              >
                Sign in with Google
              </button>
            )}
          </div>
        )}
      </header>

      {/* Slide-over Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
