'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Lock,
  ArrowLeft,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Info,
  LogIn,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatNaira, isValidNigerianPhone } from '@/lib/formatters';
import { WebhookResponse, OrderSubmissionPayload } from '@/types';
import { useAuth } from '@/context/AuthContext';

export default function CheckoutPage() {
  const router = useRouter();
  const {
    user,
    profile,
    accessToken,
    loading: authLoading,
    authError,
    signInWithGoogle,
  } = useAuth();
  const {
    items,
    cartSubtotal,
    promoPreview,
    hasOverStockItems,
    overStockItems,
    clearCart,
    isInitialized,
  } = useCart();

  // Client-generated UUID for idempotency, preserved across retries
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Field Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; retryable?: boolean } | null>(
    null
  );
  const [signInError, setSignInError] = useState<string | null>(null);
  const [isStartingSignIn, setIsStartingSignIn] = useState(false);

  // Initialize or restore idempotency key on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let key = sessionStorage.getItem('voltedge_checkout_idempotency_key');
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem('voltedge_checkout_idempotency_key', key);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdempotencyKey(key);
  }, []);

  useEffect(() => {
    if (!user) return;
    const metadata = user.user_metadata || {};
    const fullName =
      profile?.name ||
      metadata.full_name ||
      metadata.name ||
      [metadata.given_name, metadata.family_name].filter(Boolean).join(' ');
    // Prefill after the signed-in profile arrives; keep any customer edits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName((current) => current || fullName || '');
    setEmail((current) => current || profile?.email || user.email || '');
    setPhone((current) => current || profile?.phone || metadata.phone || '');
  }, [profile, user]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!user) {
      newErrors.auth = 'Sign in before submitting an order.';
    }

    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Full name is required (minimum 2 characters)';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      newErrors.email = 'Please provide a valid email address';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Nigerian phone number is required';
    } else if (!isValidNigerianPhone(phone)) {
      newErrors.phone = 'Enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)';
    }

    if (items.length === 0) {
      newErrors.cart = 'Your cart is empty. Add products before checking out.';
    }
    if (hasOverStockItems) {
      newErrors.cart = 'Reduce quantities to current stock before submitting.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double-clicks

    setServerError(null);
    if (!user) {
      setServerError({ message: 'Sign in before submitting an order.', retryable: false });
      return;
    }
    if (hasOverStockItems) {
      setServerError({
        message: 'One or more quantities exceed current stock. Reduce them before submitting.',
        retryable: false,
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const payload: OrderSubmissionPayload = {
      idempotency_key: idempotencyKey,
      submitted_at: new Date().toISOString(),
      source: 'storefront-web',
      customer: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
      },
      delivery: {
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      items: items.map(({ product, quantity }) => ({
        product_id: product.id,
        name: product.name,
        quantity,
        unit_price_displayed: product.price,
      })),
    };

    try {
      const token = await accessToken();
      if (!token) throw new Error('Your sign-in session has expired. Sign in again before checking out.');
      const response = await fetch('/api/orders/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Preserves cart on failure, allows retry with the same idempotency key
        setServerError({
          message:
            data.message ||
            'Order intake server encountered an error. Your cart is preserved and no charges occurred.',
          retryable: data.retryable !== false,
        });
        setIsSubmitting(false);
        return;
      }

      // Order submission successful!
      // Rotate idempotency key for next session
      sessionStorage.removeItem('voltedge_checkout_idempotency_key');

      // Save webhook response and order info to sessionStorage so Result page renders even on refresh
      const webhookResponse = data as WebhookResponse;
      sessionStorage.setItem('voltedge_last_order_result', JSON.stringify(webhookResponse));
      sessionStorage.setItem(
        'voltedge_last_order_customer',
        JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
        })
      );

      // Clear cart only after successful response
      clearCart();

      // Navigate to order outcome page
      router.push(`/order/result?ref=${encodeURIComponent(webhookResponse.order_ref)}`);
    } catch (error) {
      setServerError({
        message: error instanceof Error
          ? error.message
          : 'Network connection interrupted or service timed out. Your cart is preserved. Please click retry to submit again.',
        retryable: true,
      });
      setIsSubmitting(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading your checkout session...</p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Checking your sign-in status...</p>
      </div>
    );
  }

  if (!user) {
    const handleSignIn = async () => {
      setSignInError(null);
      setIsStartingSignIn(true);
      try {
        await signInWithGoogle('/checkout');
      } catch (error) {
        setSignInError(error instanceof Error ? error.message : 'Unable to start Google sign-in.');
        setIsStartingSignIn(false);
      }
    };

    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white">Sign in to continue</h1>
        <p className="text-sm text-slate-400">
          Checkout is available to signed-in customers. Your cart will be kept while you sign in.
        </p>
        {(signInError || authError) && (
          <p role="alert" className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-200">
            {signInError || authError}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleSignIn()}
          disabled={isStartingSignIn}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
        >
          {isStartingSignIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {isStartingSignIn ? 'Opening Google sign-in...' : 'Sign in with Google'}
        </button>
        <div>
          <Link href="/" className="text-xs text-slate-400 hover:text-white">
            Continue browsing
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white">Your Cart is Empty</h1>
        <p className="text-sm text-slate-400">
          You must add items from the catalogue before proceeding to checkout.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Browse Catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
        <div>
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Continue Shopping
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Checkout & Order Request
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <Lock className="w-3.5 h-3.5 text-cyan-400" />
          <span>Encrypted Intake</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Form: Customer & Delivery Details */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Customer Information Card */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Customer Information
              </h2>

              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label htmlFor="customer-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    placeholder="e.g. Babatunde Adeyemi"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl bg-slate-900 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 transition-all ${
                      errors.name
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                        : 'border-slate-800 focus:border-cyan-500 focus:ring-cyan-500'
                    }`}
                  />
                  {errors.name && <p className="mt-1 text-xs text-rose-400">{errors.name}</p>}
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="customer-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="customer-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl bg-slate-900 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 transition-all ${
                      errors.email
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                        : 'border-slate-800 focus:border-cyan-500 focus:ring-cyan-500'
                    }`}
                  />
                  {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">
                    Order status and tracking lookups are authenticated via this email.
                  </p>
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="customer-phone" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Phone Number (Nigerian Format) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="customer-phone"
                      type="tel"
                      placeholder="08012345678 or +2348012345678"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl bg-slate-900 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 transition-all ${
                        errors.phone
                          ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                          : 'border-slate-800 focus:border-cyan-500 focus:ring-cyan-500'
                      }`}
                    />
                  </div>
                  {errors.phone && <p className="mt-1 text-xs text-rose-400">{errors.phone}</p>}
                </div>
              </div>
            </div>

            {/* Delivery Details Card */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-bold">
                  2
                </span>
                Delivery Destination & Notes (Optional)
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="delivery-address" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Delivery Address
                  </label>
                  <textarea
                    id="delivery-address"
                    rows={2}
                    placeholder="Plot / Street address, City, State (e.g. Victoria Island, Lagos)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="order-notes" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Special Instructions / Order Notes
                  </label>
                  <input
                    id="order-notes"
                    type="text"
                    placeholder="Gate code, company recipient name, preferred contact time..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Server Error Alert with Retry */}
            {serverError && (
              <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-700/60 text-rose-200 text-xs space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-300">Submission Notice</p>
                    <p className="mt-0.5 text-rose-200/90 leading-relaxed">
                      {serverError.message}
                    </p>
                  </div>
                </div>
                {serverError.retryable && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-100 font-semibold text-xs transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                    Retry Order Submission
                  </button>
                )}
              </div>
            )}

            {/* Over-Stock Review Warning if applicable */}
            {hasOverStockItems && (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-xs text-amber-200 space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-300">Notice: Quantity Exceeds Shelved Stock</p>
                    <p className="mt-0.5 text-amber-200/90 leading-relaxed">
                      The following item(s) exceed current warehouse shelf levels:{' '}
                      <strong>{overStockItems.map((i) => `${i.product.name} (requested ${i.quantity}, shelf ${i.product.stock_quantity})`).join(', ')}</strong>.
                    </p>
                    <p className="mt-1 text-amber-300/90">
                      Reduce each quantity to the available stock before continuing. Checkout is disabled until your cart is within stock.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Idempotency reference indicator */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
              <span>Session Key: {idempotencyKey.slice(0, 8)}...{idempotencyKey.slice(-6)}</span>
              <span>Double-click protected</span>
            </div>

            {/* Submission CTA */}
            <button
              id="submit-order-button"
              type="submit"
              disabled={isSubmitting || hasOverStockItems}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-xl ${
                isSubmitting || hasOverStockItems
                  ? `bg-slate-800 text-slate-400 ${isSubmitting ? 'cursor-wait' : 'cursor-not-allowed'}`
                  : 'bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/20 active:scale-98'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting to Intake Engine...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>{hasOverStockItems ? 'Reduce quantities to continue' : `Submit Order Request • ${formatNaira(cartSubtotal)}`}</span>
                </>
              )}
            </button>

            {/* Honest Compliance Notice */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Info className="w-4 h-4 text-cyan-400" />
                <span>Important Consumer Notice</span>
              </div>
              <p>
                <strong>Submission is not payment.</strong> Submitting this request registers your order for automated processing with our n8n backend workflow. Payment is pending until verified by our sales team. We do not charge cards or debit accounts at this step.
              </p>
              <p className="text-[11px] text-slate-400">
                VoltEdge does not provide estimated delivery dates at order submission. Delivery timelines are communicated after verified payment.
              </p>
            </div>
          </form>
        </div>

        {/* Right Summary Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6 sticky top-28">
            <h2 className="text-base font-semibold text-white">Order Summary</h2>

            {/* Items Mini List */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {items.map(({ product, quantity }) => {
                const isOver = quantity > product.stock_quantity;
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0"
                  >
                    <div className="relative w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {product.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Qty: <span className="font-mono text-slate-200">{quantity}</span> × {formatNaira(product.price)}
                      </p>
                      {isOver && (
                        <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          Exceeds available stock (max: {product.stock_quantity})
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-200 shrink-0">
                      {formatNaira(product.price * quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Promo Live Preview Card */}
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                promoPreview.qualifies
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  5% Store-Credit Bonus
                </span>
                {promoPreview.qualifies ? (
                  <span className="font-mono font-bold text-cyan-300">
                    +{formatNaira(promoPreview.bonusAmount)}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Requires ₦500k+</span>
                )}
              </div>

              <div className="text-[11px] leading-relaxed text-slate-400">
                {promoPreview.qualifies ? (
                  <p>
                    <strong className="text-cyan-300">Promo Qualified:</strong> Estimated store-credit bonus of{' '}
                    <span className="text-cyan-200 font-mono font-bold">{formatNaira(promoPreview.bonusAmount)}</span>.
                    This preview is <span className="underline italic text-cyan-300">pending until payment is verified</span>. n8n business workflow is the final authority.
                  </p>
                ) : (
                  <p>
                    Orders of ₦500,000 or more qualify for 5% store-credit bonus. Add{' '}
                    <span className="text-cyan-300 font-mono font-medium">
                      {formatNaira(promoPreview.remainingToQualify)}
                    </span>{' '}
                    more to qualify (pending payment verification).
                  </p>
                )}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Items Subtotal</span>
                <span className="font-mono text-slate-200">{formatNaira(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Payment Verification Fee</span>
                <span className="font-mono text-emerald-400">₦0.00 (Free)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Bonus Store Credit</span>
                <span className="font-mono text-cyan-300">
                  {promoPreview.qualifies
                    ? `+${formatNaira(promoPreview.bonusAmount)} (Pending)`
                    : '₦0.00'}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                <span>Total Due Upon Approval</span>
                <span className="font-mono text-cyan-300 text-lg">
                  {formatNaira(cartSubtotal)}
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
