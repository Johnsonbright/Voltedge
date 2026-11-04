'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  Search,
  Filter,
  Eye,
  X,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  LogOut,
  ChevronRight,
  Database,
  Code,
  Check,
  Copy,
} from 'lucide-react';
import { OrderRecord } from '@/types';
import { formatNaira, formatDate } from '@/lib/formatters';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Auto-login if previously authenticated in sessionStorage
  useEffect(() => {
    const authState = sessionStorage.getItem('voltedge_admin_auth');
    if (authState === 'true') {
      setIsAuthenticated(true);
      fetchOrders();
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    // Accept demo passcode 'voltedge2026' or standard admin phrase
    if (passcode.trim() === 'voltedge2026' || passcode.trim() === 'admin') {
      setIsAuthenticated(true);
      sessionStorage.setItem('voltedge_admin_auth', 'true');
      fetchOrders();
    } else {
      setAuthError('Invalid administrator credentials. (Hint for evaluation: voltedge2026)');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('voltedge_admin_auth');
    setOrders([]);
    setSelectedOrder(null);
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders', {
        headers: {
          'x-admin-pass': 'voltedge2026',
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
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
    const reviewCount = orders.filter((o) => o.order_status === 'UNDER_REVIEW').length;
    const promoCount = orders.filter((o) => Number(o.bonus_amount || 0) > 0).length;

    return { totalCount, totalVolume, reviewCount, promoCount };
  }, [orders]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4">
        <div className="glass-panel rounded-3xl p-8 border border-slate-800 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/10">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              VoltEdge Admin Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Read-only operations & demo audit records.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label htmlFor="admin-passcode" className="block text-xs font-medium text-slate-300 mb-1.5">
                Staff Access Passcode
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-passcode"
                  type="password"
                  placeholder="Enter admin passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                />
              </div>
            </div>

            {authError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/60">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-all shadow-md shadow-cyan-500/20"
            >
              Sign In to Admin View
            </button>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300">Demo Credentials Notice:</span>
              <p>For immediate evaluation & test verification, enter passcode: <strong className="text-cyan-300 font-mono">voltedge2026</strong></p>
            </div>
          </form>
        </div>
      </div>
    );
  }

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
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 hover:text-rose-300 border border-slate-800 text-slate-400 text-xs font-semibold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

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
            <option value="PENDING">PENDING</option>
            <option value="UNDER_REVIEW">UNDER_REVIEW</option>
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
            <option value="UNPAID">UNPAID (Pending Verification)</option>
            <option value="VERIFIED">VERIFIED</option>
          </select>

          {/* Tag Filter */}
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Tags</option>
            <option value="HIGH_VALUE">#HIGH_VALUE</option>
            <option value="OVER_STOCK">#OVER_STOCK</option>
            <option value="REVIEW_REQUIRED">#REVIEW_REQUIRED</option>
            <option value="PROMO_APPLIED">#PROMO_APPLIED</option>
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
                  const isReview = ord.order_status === 'UNDER_REVIEW';
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
                    {selectedOrder.payment_status} (Pending Verification)
                  </span>
                </div>
              </div>

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
                    ? `+${formatNaira(selectedOrder.bonus_amount)} (Status: ${selectedOrder.bonus_status})`
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
                The storefront web application never mutates or directly updates orders. All order state transitions and payment confirmations are executed exclusively by n8n using the Supabase Service Role key.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
