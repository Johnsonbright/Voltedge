'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminClient';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/formatters';

type CustomerTag = { id: string; tag: string };
type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  lifecycle_label: string;
  created_at: string;
  tags: CustomerTag[];
};

const labels = [
  'ALL',
  'PROSPECT',
  'INTERESTED',
  'LEAD',
  'CUSTOMER',
  'RETURNING_CUSTOMER',
  'VIP_CUSTOMER',
];

export default function AdminCustomersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [label, setLabel] = useState('ALL');
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [vipSpend, setVipSpend] = useState('');
  const [vipOrders, setVipOrders] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const superAdmin = profile?.role === 'super_admin';

  const loadCustomers = useCallback(async () => {
    const response = await adminFetch(`/api/admin/customers?label=${encodeURIComponent(label)}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load customers.');
    setCustomers(data.customers);
  }, [label]);

  const loadSettings = useCallback(async () => {
    if (!superAdmin) return;
    const response = await adminFetch('/api/admin/settings');
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load VIP settings.');
    setVipSpend(String(data.settings.vip_minimum_spend));
    setVipOrders(String(data.settings.vip_minimum_paid_orders));
  }, [superAdmin]);

  useEffect(() => {
    // Load protected customer data when the active lifecycle filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.all([loadCustomers(), loadSettings()])
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load customers.'))
      .finally(() => setLoading(false));
  }, [loadCustomers, loadSettings]);

  const addTag = async (event: FormEvent<HTMLFormElement>, customer: Customer) => {
    event.preventDefault();
    const tag = tagInputs[customer.id]?.trim();
    if (!tag) return;
    setError(null);
    try {
      const response = await adminFetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: customer.id, tag }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to add tag.');
      setTagInputs((current) => ({ ...current, [customer.id]: '' }));
      setNotice('Customer tag added.');
      await loadCustomers();
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : 'Unable to add tag.');
    }
  };

  const removeTag = async (id: string) => {
    setError(null);
    try {
      const response = await adminFetch('/api/admin/customers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to remove tag.');
      await loadCustomers();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove tag.');
    }
  };

  const saveVipSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const response = await adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vip_minimum_spend: Number(vipSpend),
          vip_minimum_paid_orders: Number(vipOrders),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save VIP settings.');
      setNotice('VIP thresholds saved. Lifecycle labels have been recalculated.');
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : 'Unable to save VIP settings.');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">Customer lifecycle</p>
        <h1 className="text-2xl font-bold text-white mt-1">Customers</h1>
        <p className="text-sm text-slate-400 mt-1">Labels are derived from carts and verified order/payment data.</p>
      </header>

      {error && <p role="alert" className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-sm text-emerald-200">{notice}</p>}

      {superAdmin && (
        <form onSubmit={saveVipSettings} className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-3">
          <h2 className="font-semibold text-white">VIP thresholds</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-300">Verified spend (₦)
              <input required type="number" min="0" step="1" value={vipSpend} onChange={(event) => setVipSpend(event.target.value)} className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-300">Verified paid orders
              <input required type="number" min="1" step="1" value={vipOrders} onChange={(event) => setVipOrders(event.target.value)} className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
            </label>
          </div>
          <button type="submit" className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950">Save thresholds</button>
        </form>
      )}

      <section className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Accounts ({customers.length})</h2>
          <select value={label} onChange={(event) => setLabel(event.target.value)} className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-200">
            {labels.map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All lifecycle labels' : value}</option>)}
          </select>
        </div>
        {loading ? <p className="p-5 text-sm text-slate-400">Loading customers...</p> : customers.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No registered customers match this filter.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {customers.map((customer) => (
              <article key={customer.id} className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-white">{customer.name || 'Customer'}</h3>
                    <p className="text-xs text-slate-400">{customer.email} · {customer.phone || 'No phone'} · Joined {formatDate(customer.created_at)}</p>
                  </div>
                  <span className="w-fit rounded-full border border-cyan-800 bg-cyan-950 px-2.5 py-1 text-[10px] font-mono text-cyan-300">{customer.lifecycle_label}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {customer.tags.map((tag) => (
                    <button key={tag.id} type="button" onClick={() => void removeTag(tag.id)} title="Remove manual tag" className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] text-slate-300 hover:border-rose-700">
                      {tag.tag} ×
                    </button>
                  ))}
                </div>
                <form onSubmit={(event) => void addTag(event, customer)} className="flex gap-2">
                  <input aria-label={`Manual tag for ${customer.email}`} maxLength={64} value={tagInputs[customer.id] || ''} onChange={(event) => setTagInputs((current) => ({ ...current, [customer.id]: event.target.value }))} placeholder="Add manual tag" className="min-w-0 flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white" />
                  <button type="submit" className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900">Add tag</button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
