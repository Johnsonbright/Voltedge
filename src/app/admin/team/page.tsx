'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminClient';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/formatters';

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'super_admin';
  created_at: string;
};

export default function AdminTeamPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const response = await adminFetch('/api/admin/team');
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load team accounts.');
    setUsers(data.users);
  }, []);

  useEffect(() => {
    // Load the role directory after this protected page mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers()
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load team accounts.'))
      .finally(() => setLoading(false));
  }, [loadUsers]);

  const updateRole = async (member: TeamUser) => {
    setError(null);
    try {
      const response = await adminFetch('/api/admin/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: member.id,
          role: member.role === 'admin' ? 'customer' : 'admin',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to change role.');
      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to change role.');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">Access control</p>
        <h1 className="text-2xl font-bold text-white mt-1">Team roles</h1>
        <p className="text-sm text-slate-400 mt-1">Promote registered customers to admin or demote admins.</p>
      </header>
      {error && <p role="alert" className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-sm text-rose-200">{error}</p>}
      <section className="glass-panel rounded-2xl border border-slate-800 divide-y divide-slate-800">
        {loading ? <p className="p-5 text-sm text-slate-400">Loading accounts...</p> : users.map((member) => (
          <div key={member.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-white">{member.name || 'Customer'}</p>
              <p className="text-xs text-slate-400">{member.email} · Joined {formatDate(member.created_at)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-cyan-300">{member.role}</span>
              {member.role !== 'super_admin' && member.id !== user?.id && (
                <button type="button" onClick={() => void updateRole(member)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900">
                  {member.role === 'admin' ? 'Demote to customer' : 'Promote to admin'}
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
