'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Sparkles,
  PackageCheck,
  FileQuestion,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { OrderRecord } from '@/types';
import { formatNaira, formatDate } from '@/lib/formatters';

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get('ref') || '';
  const initialEmail = searchParams.get('email') || '';

  const [orderRef, setOrderRef] = useState(initialRef);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-fetch if both ref and email are present in query params
  useEffect(() => {
    if (initialRef && initialEmail) {
      handleLookup(initialRef, initialEmail);
    }
  }, [initialRef, initialEmail]);

  const handleLookup = async (refToQuery: string, emailToQuery: string) => {
    const trimmedRef = refToQuery.trim();
    const trimmedEmail = emailToQuery.trim().toLowerCase();

    if (!trimmedRef) {
      setError('Please enter your order reference number (e.g. VE-20261104-XXXX)');
      return;
    }
    if (!trimmedEmail) {
      setError('Please enter the customer email address used during order placement.');
      return;
    }

    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_ref: trimmedRef,
          email: trimmedEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'No order found matching the provided reference and email.');
      } else {
        setOrder(data.order);
      }
    } catch {
      setError('Network communication failed. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(orderRef, email);
  };

  const copyRef = (refText: string) => {
    navigator.clipboard.writeText(refText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Track Your Order Status
        </h1>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Enter your order reference and billing email address to check verified processing progress and review notes.
        </p>
      </div>

      {/* Lookup Form */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="track-order-ref" className="block text-xs font-medium text-slate-300 mb-1.5">
                Order Reference Number
              </label>
              <input
                id="track-order-ref"
                type="text"
                placeholder="e.g. VE-20261104-ABC12"
                value={orderRef}
                onChange={(e) => setOrderRef(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all uppercase"
              />
            </div>

            <div>
              <label htmlFor="track-customer-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Customer Email Address
              </label>
              <input
                id="track-customer-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>
          </div>

          <button
            id="track-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking Database Records...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Find Order</span>
              </>
            )}
          </button>
        </form>

        {/* Error Notice */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">Order Not Located</p>
              <p className="mt-0.5 text-rose-200/90 leading-relaxed">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Display if found */}
      {order && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Status Header Card */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">
                  Order Record
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="text-xl font-bold font-mono text-cyan-400">{order.order_ref}</h2>
                  <button
                    onClick={() => copyRef(order.order_ref)}
                    className="text-slate-400 hover:text-white"
                    title="Copy reference"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Placed:</span>
                <span className="text-xs font-medium text-slate-200">{formatDate(order.created_at)}</span>
              </div>
            </div>

            {/* Status Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Order Status
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      order.order_status === 'CONFIRMED'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : order.order_status === 'UNDER_REVIEW'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {order.order_status}
                  </span>
                  {order.order_status === 'UNDER_REVIEW' && (
                    <span className="text-[11px] text-amber-300/80">Pending Stock Review</span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Payment Status
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      order.payment_status === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}
                  >
                    {order.payment_status}
                  </span>
                  <span className="text-[11px] text-amber-300/90 font-medium">
                    (Pending Verification)
                  </span>
                </div>
              </div>
            </div>

            {/* Honest Consumer Rule Alert */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Verification Policy</span>
              </div>
              <p>
                Payment is pending until verified. Delivery dates are not promised or scheduled at order submission time. Warehouse fulfillment initiates once verified payment is confirmed.
              </p>
            </div>

            {/* Review Reasons if present */}
            {order.review_reasons && order.review_reasons.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/30 text-xs text-amber-200 space-y-1">
                <p className="font-semibold text-amber-300">Staff Review Flags:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-amber-200/90">
                  {order.review_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Items & Financial Breakdown */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Ordered Items
            </h3>

            {order.order_items && order.order_items.length > 0 ? (
              <div className="divide-y divide-slate-800 text-xs">
                {order.order_items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{item.product_name}</p>
                      <p className="text-slate-400">
                        {item.quantity} × {formatNaira(item.unit_price)}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-slate-200">
                      {formatNaira(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Items recorded in system payload.</p>
            )}

            {/* High Value Bonus Row */}
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/60 -mx-6 px-6 py-3">
              <div>
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  High-Value Store Credit Bonus
                </span>
                <p className="text-[11px] text-slate-400">
                  {Number(order.bonus_amount) > 0 ? (
                    <>
                      Amount:{' '}
                      <strong className="text-cyan-300 font-mono">
                        +{formatNaira(order.bonus_amount)}
                      </strong>{' '}
                      (<span className="italic underline text-cyan-300">pending until payment is verified</span>)
                    </>
                  ) : (
                    'Not eligible (below ₦500,000 threshold)'
                  )}
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {order.bonus_status}
              </span>
            </div>

            {/* Total */}
            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
              <span className="text-slate-300">Order Subtotal</span>
              <span className="text-lg font-mono text-cyan-300">{formatNaira(order.total)}</span>
            </div>
          </div>

          {/* Delivery & Recipient Information */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-3 text-xs">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Recipient & Delivery Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-400">
              <div>
                <span className="block text-slate-400 font-medium">Customer Name</span>
                <span className="text-white font-medium">{order.customer_name}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-medium">Contact Phone</span>
                <span className="text-white font-mono">{order.customer_phone}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="block text-slate-400 font-medium">Delivery Address</span>
                <span className="text-slate-200">
                  {order.delivery_address || 'No specific street address provided (Local Lagos pickup / customer service coordination).'}
                </span>
              </div>
              {order.delivery_notes && (
                <div className="sm:col-span-2">
                  <span className="block text-slate-400 font-medium">Order Notes</span>
                  <span className="text-slate-300 italic">{order.delivery_notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-slate-400 text-sm">
          Loading order tracking...
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
