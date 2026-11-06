import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getServerAuthState } from '@/lib/supabaseServer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'VoltEdge Electronics | Premium Hardware Retailer Nigeria',
  description:
    'Browse premium laptops, smartphones, consoles, and tech gear at VoltEdge Electronics. Direct Nigerian pricing in Naira with transparent order intake and tracking.',
  keywords: [
    'VoltEdge Electronics',
    'Electronics Nigeria',
    'MacBook Air M4 Lagos',
    'Samsung Galaxy S25 Ultra Nigeria',
    'PS5 Slim Nigeria',
    'Tech Store Nigeria',
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getServerAuthState();

  return (
    <html
      lang="en-NG"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
        <AuthProvider
          key={`${auth.user?.id || 'anonymous'}:${auth.profile?.role || 'none'}`}
          initialUser={auth.user}
          initialProfile={auth.profile}
          initialError={auth.error}
        >
          <CartProvider>
            <Navbar />
            <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
            <Footer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
