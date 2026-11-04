import React from 'react';
import Link from 'next/link';
import { Zap, ShieldCheck, HelpCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950 mt-20 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center text-slate-950 font-bold">
                <Zap className="w-4 h-4 fill-current" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                VoltEdge Electronics
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              Nigeria&apos;s trusted enterprise electronics retailer. Delivering authentic flagship hardware across Nigeria with transparent order verification and business tracking.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Operational Headquarters: Victoria Island, Lagos, Nigeria</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">
              Store Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-cyan-400 transition-colors">
                  Product Catalogue
                </Link>
              </li>
              <li>
                <Link href="/track" className="hover:text-cyan-400 transition-colors">
                  Track Existing Order
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-cyan-400 transition-colors">
                  Staff Admin Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Integrity & Compliance Notice */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Order Integrity Policy
            </h4>
            <div className="text-xs text-slate-400 space-y-2 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-800">
              <p>
                <strong className="text-slate-300">Submission is not payment.</strong> All orders are received as requests pending inventory validation and manual payment confirmation.
              </p>
              <p>
                Store-credit bonuses are provisional and labeled <em className="text-cyan-300">pending until payment is verified</em>. We do not promise fixed delivery dates at submission.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} VoltEdge Electronics Ltd. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              Automated processing by n8n workflow engine
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
