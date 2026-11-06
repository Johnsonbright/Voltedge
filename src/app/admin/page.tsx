'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Eye,
  X,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Check,
  Copy,
} from 'lucide-react';
import { OrderRecord } from '@/types';
import { formatNaira, formatDate } from '@/lib/formatters';
import { adminFetch } from '@/lib/adminClient';

export default function AdminPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/orders');
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.orders)) {
        throw new Error(data.message || 'Failed to load orders.');
      }
      setOrders(data.orders);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load the protected order list after this page mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrders();
  }, [loadOrders]);

  const fetchOrders = async () => {
    setLoading(true);
    setFetchError(null);
    await loadOrders();
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        o.order_ref.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        o.customer_phone.includes(q);

      const matchesStatus = statusFilter === 'ALL' || o.order_status === statusFilter;
      const matchesPayment = paymentFilter === 'ALL' || o.payment_status === paymentFilter;
      const matchesTag = tagFilter === 'ALL' || (o.tags && o.tags.includes(tagFilter));

      return matchesSearch && matchesStatus && matchesPayment && matchesTag;
    });
  }, [orders, searchQuery, statusFilter, paymentFilter, tagFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalCount = orders.length;
    const totalVolume = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const reviewCount = orders.filter((o) => ['UNDER_REVIEW', 'REVIEW_REQUIRED'].includes(o.order_status)).length;
    const promoCount = orders.filter((o) => Number(o.bonus_amount || 0) > 0).length;

    return { totalCount, totalVolume, reviewCount, promoCount };
  }, [orders]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const markPaymentVerified = async () => {
    if (!selectedOrder) return;
    setVerifyingPayment(true);
    setFetchError(null);
    setActionNotice(null);
    try {
      const response = await adminFetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ref: selectedOrder.order_ref }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to verify payment.');
      setSelectedOrder(data.order);
      setOrders((current) => current.map((order) => order.id === data.order.id ? data.order : order));
      setActionNotice(data.message);
    } catch (actionError) {
      setFetchError(actionError instanceof Error ? actionError.message : 'Unable to verify payment.');
    } finally {
      setVerifyingPayment(false);
    }
  };

  return (
    <div className="space-y-8 py-2">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
              Read-Only
            </span>
            <span className="text-xs text-slate-400">Supabase Service Role View</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Orders Audit Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition-all"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {fetchError && (
        <p className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-3 text-sm text-rose-200">
          {fetchError}
        </p>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Orders Logged</span>
          <p className="text-2xl font-bold font-mono text-white">{metrics.totalCount}</p>
          <span className="text-[11px] text-slate-400">Intake submissions</span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Pipeline Value</span>
          <p className="text-xl font-bold font-mono text-cyan-300">
            {formatNaira(metrics.totalVolume)}
          </p>
          <span className="text-[11px] text-slate-400">Authoritative recalculation</span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
          <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Under Stock Review
          </span>
          <p className="text-2xl font-bold font-mono text-amber-300">{metrics.reviewCount}</p>
          <span className="text-[11px] text-amber-400/80">Qty exceeded shelf stock</span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
          <span className="text-xs text-cyan-400 font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> High-Value Promos
          </span>
          <p className="text-2xl font-bold font-mono text-cyan-300">{metrics.promoCount}</p>
          <span className="text-[11px] text-cyan-400/80">≥ ₦500k orders (5% bonus)</span>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Ref, Name, Email, Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Order Statuses</option>
            <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
            <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
            <option value="PENDING">PENDING (legacy)</option>
            <option value="UNDER_REVIEW">UNDER_REVIEW (legacy)</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="PAYMENT_PENDING">PAYMENT_PENDING</option>
            <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED</option>
          </select>

          {/* Tag Filter */}
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Tags</option>
            <option value="HIGH_VALUE_ORDER">#HIGH_VALUE_ORDER</option>
            <option value="STANDARD_ORDER">#STANDARD_ORDER</option>
            <option value="INCOMPLETE_ORDER">#INCOMPLETE_ORDER</option>
            <option value="REVIEW_REQUIRED">#REVIEW_REQUIRED</option>
            <option value="PAYMENT_CONFIRMED">#PAYMENT_CONFIRMED</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-3 px-4">Order Ref</th>
                <th className="py-3 px-4">Created (WAT)</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Promo Bonus</th>
                <th className="py-3 px-4">Order Status</th>
                <th className="py-3 px-4">Tags</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-300">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No order records found matching the active filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isReview = ord.order_status === 'UNDER_REVIEW' || ord.order_status === 'REVIEW_REQUIRED';
                  const hasBonus = Number(ord.bonus_amount || 0) > 0;
                  return (
                    <tr
                      key={ord.id}
                      className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedOrder(ord)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                        {ord.order_ref}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {formatDate(ord.created_at)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{ord.customer_name}</div>
                        <div className="text-[11px] text-slate-400">{ord.customer_email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-white whitespace-nowrap">
                        {formatNaira(ord.total)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasBonus ? (
                          <span className="text-cyan-300 font-mono font-semibold">
                            +{formatNaira(ord.bonus_amount)}
                            <span className="block text-[10px] text-slate-400">Pending Verify</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isReview
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-slate-800 text-slate-200 border-slate-700'
                          }`}
                        >
                          {ord.order_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {ord.tags?.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(ord);
                          }}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          title="Inspect Order"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setSelectedOrder(null)}
          />

          <div className="relative z-10 w-full max-w-xl bg-slate-950 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-950/90 backdrop-blur z-20">
              <div>
                <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                  Order Audit Detail
                </span>
                <h3 className="text-xl font-bold font-mono text-white mt-0.5">
                  {selectedOrder.order_ref}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Review reasons banner if present */}
              {selectedOrder.review_reasons && selectedOrder.review_reasons.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-xs text-amber-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Review Flags (n8n Engine Output)</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-amber-200/90 font-mono text-[11px]">
                    {selectedOrder.review_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Status & Payment Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <span className="text-slate-400 block font-medium">Order Status</span>
                  <span className="font-bold text-white text-sm">{selectedOrder.order_status}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <span className="text-slate-400 block font-medium">Payment Status</span>
                  <span className="font-bold text-amber-300 text-sm">
                    {selectedOrder.payment_status}
                  </span>
                </div>
              </div>
              {actionNotice && <p role="status" className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-3 text-xs text-emerald-200">{actionNotice}</p>}
              {selectedOrder.payment_status !== 'PAYMENT_CONFIRMED' && selectedOrder.payment_status !== 'VERIFIED' && (
                <button
                  type="button"
                  onClick={() => void markPaymentVerified()}
                  disabled={verifyingPayment}
                  className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {verifyingPayment ? 'Saving verification...' : 'Mark payment verified'}
                </button>
              )}

              {/* Customer Information */}
              <div className="glass-panel rounded-xl p-4 border border-slate-800 text-xs space-y-2">
                <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                  Customer & Delivery Info
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  <div>
                    <span className="text-slate-400 block">Name:</span>
                    <span className="text-white font-medium">{selectedOrder.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Phone:</span>
                    <span className="text-white font-mono">{selectedOrder.customer_phone}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Email:</span>
                    <span className="text-white font-mono">{selectedOrder.customer_email}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Address:</span>
                    <span className="text-slate-200">
                      {selectedOrder.delivery_address || 'None provided'}
                    </span>
                  </div>
                  {selectedOrder.delivery_notes && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block">Notes:</span>
                      <span className="text-slate-300 italic">{selectedOrder.delivery_notes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ordered Items Breakdown */}
              <div className="glass-panel rounded-xl p-4 border border-slate-800 text-xs space-y-3">
                <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                  Order Items ({selectedOrder.order_items?.length || 0})
                </h4>
                <div className="divide-y divide-slate-800">
                  {selectedOrder.order_items?.map((item) => (
                    <div key={item.id} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-medium text-white">{item.product_name}</span>
                        <span className="text-slate-400 block text-[11px]">
                          {item.quantity} × {formatNaira(item.unit_price)}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-200">
                        {formatNaira(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-300">Total Pipeline Value:</span>
                  <span className="font-mono text-cyan-300">{formatNaira(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Bonus Information */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-400 font-medium block">Store Credit Bonus Evaluation:</span>
                <p className="text-cyan-300 font-mono font-bold">
                  {Number(selectedOrder.bonus_amount || 0) > 0
                    ? `+${formatNaira(selectedOrder.bonus_amount)} (Status: ${selectedOrder.bonus_status === 'ACTIVATED' ? 'PENDING WORKFLOW' : selectedOrder.bonus_status})`
                    : 'Not Eligible'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Labeled <em>pending until payment is verified</em>. n8n workflow controls bonus crediting.
                </p>
              </div>

              {/* Idempotency Key */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] font-mono flex items-center justify-between text-slate-400">
                <span className="truncate mr-2">Key: {selectedOrder.idempotency_key}</span>
                <button
                  onClick={() => copyToClipboard(selectedOrder.idempotency_key, 'key')}
                  className="text-slate-400 hover:text-white shrink-0"
                >
                  {copiedKey === 'key' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Raw JSON Payload Inspector */}
              {selectedOrder.raw_payload && (
                <div className="space-y-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Raw Intake Payload (JSONB)
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedOrder.raw_payload, null, 2)}
                  </pre>
                </div>
              )}

              {/* Architectural Authority Notice */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-[11px] leading-relaxed">
                <span className="font-semibold text-slate-300 block mb-1">
                  Database & System Architecture
                </span>
                Order data is written by the server-side n8n integration. Authorized admins can mark payment verified here; bonus crediting remains a separate workflow action.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
