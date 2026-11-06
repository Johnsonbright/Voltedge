import AdminShell from '@/components/AdminShell';
import { getServerAuthState } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getServerAuthState();
  if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    redirect('/');
  }

  return <AdminShell>{children}</AdminShell>;
}
