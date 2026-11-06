export type UserRole = 'customer' | 'admin' | 'super_admin';

export interface AuthUser {
  id: string;
  email: string | null;
  user_metadata: Record<string, string>;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}
