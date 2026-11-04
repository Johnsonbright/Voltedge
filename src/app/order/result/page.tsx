'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Search,
  Info,
  FileQuestion,
  HelpCircle,
} from 'lucide-react';
import { WebhookResponse } from '@/types';
import { formatNaira } from '@/lib/formatters';

function OrderResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const refParam = searchParams.get('ref');

  const [result, setResult] = useState<WebhookResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [customerEmail, setCustomerEmail] = useState<string>('');

  useEffect(() => {
    // 1. Retrieve cached webhook response from sessionStorage
    try {
      const stored = sessionStorage.getItem('voltedge_last_order_result');
      if (stored) {
        const parsed = JSON.parse(stored) as WebhookResponse;
        if (!refParam || parsed.order_ref === refParam) {
          setResult(parsed);
        }
      }
      const customerStored = sessionStorage.getItem('voltedge_last_order_customer');
      if (customerStored) {
        const parsedCust = JSON.parse(customerStored);
        setCustomerEmail(parsedCust.email || '');
      }
    } catch {
      // Ignore parse errors
    }
  }, [refParam]);

  const copyOrderRef = () => {
    if (!result?.order_ref) return;
    navigator.clipboard.writeText(result.order_ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!result) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400">
          <FileQuestion className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white">Order Reference Lookup</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          {refParam ? (
            <>
              Viewing order reference <strong className="text-white font-mono">{refParam}</strong>. To view complete real-time status and payment verification notes, please check via Order Tracking.
            </>
          ) : (
            'No active order session found in this browser tab. You can track existing orders with your reference number.'
          )}
        </p>
        <div className="pt-2">
          <Link
            href={refParam ? `/track?ref=${encodeURIComponent(refParam)}` : '/track'}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-all"
          >
            <Search className="w-4 h-4" />
            Track Order Status
          </Link>
        </div>
      </div>
    );
  }

  const { outcome, order_ref, total, bonus_amount, bonus_status, tags, message, review_reasons } =
    result;

  const isAccepted = outcome === 'ACCEPTED';
  const isReview = outcome === 'ACCEPTED_FOR_REVIEW';
  const isDuplicate = outcome === 'DUPLICATE';
  const isRejected = outcome === 'REJECTED_INCOMPLETE';

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {/* Status Hero Card */}
      <div
        className={`glass-panel rounded-3xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden ${
          isAccepted
            ? 'border-emerald-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/20'
            : isReview
            ? 'border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/25'
            : isDuplicate
            ? 'border-cyan-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/25'
            : 'border-rose-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/25'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                isAccepted
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isReview
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : isDuplicate
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isAccepted ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : isReview ? (
                <Clock className="w-8 h-8 animate-pulse" />
              ) : isDuplicate ? (
                <Info className="w-8 h-8" />
              ) : (
                <AlertTriangle className="w-8 h-8" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isAccepted
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : isReview
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : isDuplicate
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                      : 'bg-rose-950 text-rose-300 border-rose-800'
                  }`}
                >
                  {outcome.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-400">Intake Response</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                {isAccepted && 'Order Request Accepted'}
                {isReview && 'Accepted For Availability Review'}
                {isDuplicate && 'Existing Order Submission Detected'}
                {isRejected && 'Submission Incomplete'}
              </h1>
            </div>
          </div>

          {/* Reference Pill */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
            <span className="text-xs font-mono font-bold text-cyan-400">{order_ref}</span>
            <button
              onClick={copyOrderRef}
              className="text-slate-400 hover:text-white transition-colors"
              title="Copy Reference"
              aria-label="Copy Reference"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Informational Message */}
        <p className="mt-5 text-sm text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
          {message}
        </p>

        {/* Review reasons breakdown if available */}
        {review_reasons && review_reasons.length > 0 && (
          <div className="mt-4 p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-xs text-amber-200 space-y-1.5">
            <p className="font-semibold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Items Requiring Manual Verification:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-amber-200/90">
              {review_reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Critical Integrity Disclosure */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-cyan-300">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Payment & Fulfillment Transparency Policy</span>
        </div>
        <p className="leading-relaxed text-slate-400">
          <strong>Submission is not payment.</strong> No debit or charge has occurred. Payment is{' '}
          <span className="text-white font-medium underline">pending until verified</span> by our Lagos sales team. VoltEdge does not commit to fixed delivery dates or schedule dispatch until payment is formally confirmed.
        </p>
      </div>

      {/* Financial Details Table */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Order Summary & Bonus Assessment
        </h2>

        <div className="divide-y divide-slate-800 text-sm">
          <div className="py-2.5 flex justify-between items-center text-slate-400">
            <span>Order Reference</span>
            <span className="font-mono font-bold text-white">{order_ref}</span>
          </div>

          <div className="py-2.5 flex justify-between items-center text-slate-400">
            <span>Payment Status</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
              {result.payment_status} (Pending Verification)
            </span>
          </div>

          <div className="py-2.5 flex justify-between items-center text-slate-400">
            <span>Order Processing State</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-200">
              {result.order_status}
            </span>
          </div>

          <div className="py-2.5 flex justify-between items-center text-slate-400">
            <span>Authorized Total</span>
            <span className="font-mono font-bold text-white text-base">
              {formatNaira(total)}
            </span>
          </div>

          {/* High Value Bonus Status */}
          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/50 -mx-6 px-6">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>5% Store-Credit Bonus (₦500k+ orders)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {bonus_amount > 0 ? (
                  <>
                    Estimated bonus:{' '}
                    <strong className="text-cyan-300 font-mono">+{formatNaira(bonus_amount)}</strong>{' '}
                    (<span className="underline italic text-cyan-300">pending until payment is verified</span>)
                  </>
                ) : (
                  'Cart total was below ₦500,000 threshold'
                )}
              </p>
            </div>
            <div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                  bonus_status === 'PENDING_VERIFICATION'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {bonus_status === 'PENDING_VERIFICATION' ? 'PENDING VERIFICATION' : 'NOT ELIGIBLE'}
              </span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="pt-3 border-t border-slate-800 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400">Intake Tags:</span>
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Next Steps Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <Link
          href={`/track?ref=${encodeURIComponent(order_ref)}${
            customerEmail ? `&email=${encodeURIComponent(customerEmail)}` : ''
          }`}
          className="flex-1 py-3 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/20"
        >
          <Search className="w-4 h-4" />
          Track This Order
        </Link>
        <Link
          href="/"
          className="py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          Return to Storefront
        </Link>
      </div>
    </div>
  );
}

export default function OrderResultPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-slate-400 text-sm">
          Loading order outcome...
        </div>
      }
    >
      <OrderResultContent />
    </Suspense>
  );
}
