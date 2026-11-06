'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminClient';

type IntegrationForm = {
  webhook_url: string;
  test_webhook_url: string;
  environment: 'test' | 'production';
  mock_enabled: boolean;
  webhook_secret: string;
  clear_secret: boolean;
};

const emptyForm: IntegrationForm = {
  webhook_url: '',
  test_webhook_url: '',
  environment: 'test',
  mock_enabled: false,
  webhook_secret: '',
  clear_secret: false,
};

export default function AdminIntegrationsPage() {
  const [form, setForm] = useState<IntegrationForm>(emptyForm);
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [settingsSource, setSettingsSource] = useState<'database' | 'environment' | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void adminFetch('/api/admin/integrations')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load settings.');
        if (!active) return;
        setForm({
          ...emptyForm,
          webhook_url: data.settings.webhook_url || '',
          test_webhook_url: data.settings.test_webhook_url || '',
          environment: data.settings.environment,
          mock_enabled: data.settings.mock_enabled,
        });
        setSecretConfigured(data.settings.secret_configured);
        setSettingsSource(data.settings.source);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load settings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await adminFetch('/api/admin/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save settings.');
      setSecretConfigured(data.secret_configured);
      setSettingsSource('database');
      setForm((current) => ({ ...current, webhook_secret: '', clear_secret: false }));
      setNotice('Integration settings saved. Order submissions will use these settings.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!window.confirm('This sends a connection_test event to n8n. Only continue if your n8n workflow branches this event away from order processing, database inserts, and customer emails.')) {
      return;
    }
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await adminFetch('/api/admin/integrations', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Webhook test failed.');
      setNotice(data.message);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Webhook test failed.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">Connections</p>
        <h1 className="text-2xl font-bold text-white mt-1">n8n webhook</h1>
        <p className="text-sm text-slate-400 mt-1">Webhook settings are stored in Supabase and only read by server routes.</p>
      </header>

      {error && <p role="alert" className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-sm text-emerald-200">{notice}</p>}

      <form onSubmit={saveSettings} className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-5">
        {loading ? <p className="text-sm text-slate-400">Loading integration settings...</p> : (
          <>
            <p className="text-xs text-slate-500">Current settings source: {settingsSource || 'unknown'}.</p>
            <label className="block text-sm text-slate-300">Production webhook URL
              <input type="url" value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} placeholder="https://your-n8n-host/webhook/..." className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-white" />
            </label>
            <label className="block text-sm text-slate-300">Test webhook URL
              <input type="url" value={form.test_webhook_url} onChange={(e) => setForm({ ...form, test_webhook_url: e.target.value })} placeholder="https://your-n8n-host/webhook-test/..." className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-white" />
            </label>
            <label className="block text-sm text-slate-300">Active environment
              <select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value as IntegrationForm['environment'] })} className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-white">
                <option value="test">Test</option>
                <option value="production">Production</option>
              </select>
            </label>
            <label className="block text-sm text-slate-300">Webhook shared secret
              <input type="password" autoComplete="new-password" value={form.webhook_secret} onChange={(e) => setForm({ ...form, webhook_secret: e.target.value, clear_secret: false })} placeholder={secretConfigured ? 'Saved secret is hidden; leave blank to keep it' : 'Enter a new shared secret'} className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-white" />
              <span className="block mt-1 text-xs text-slate-500">{secretConfigured ? 'A secret is configured. It is never sent back to this page.' : 'No secret is currently configured.'}</span>
            </label>
            {secretConfigured && (
              <label className="inline-flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={form.clear_secret} onChange={(e) => setForm({ ...form, clear_secret: e.target.checked, webhook_secret: '' })} />
                Remove the saved secret
              </label>
            )}
            <label className="flex items-start gap-3 rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 text-sm text-amber-100">
              <input type="checkbox" checked={form.mock_enabled} onChange={(e) => setForm({ ...form, mock_enabled: e.target.checked })} className="mt-1" />
              <span><strong>Use local mock mode.</strong> When enabled, checkout submissions do not reach n8n.</span>
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={saving} className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 px-4 py-2.5 text-sm font-bold text-slate-950">
                {saving ? 'Saving...' : 'Save settings'}
              </button>
              <button type="button" onClick={() => void testConnection()} disabled={testing || saving || form.mock_enabled} className="rounded-lg border border-slate-700 hover:bg-slate-900 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-slate-200">
                {testing ? 'Testing...' : 'Send connection test'}
              </button>
            </div>
          </>
        )}
      </form>

      <aside className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-4 text-xs text-amber-100/90 space-y-2">
        <h2 className="font-semibold text-amber-200">Before sending a test event</h2>
        <p>In n8n, add a branch for <code>event = connection_test</code> and stop that branch before any order calculation, Supabase order insert, email, or internal notification. The test button sends this event to the selected webhook.</p>
        <p>For production, activate the n8n workflow, choose Production, confirm the production URL, and turn off mock mode. Always keep payment status pending until a trusted payment verification step confirms payment.</p>
      </aside>
    </div>
  );
}
