'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, AlertTriangle, Sparkles, ShieldAlert } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatNaira } from '@/lib/formatters';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const {
    items,
    removeItem,
    updateQuantity,
    cartSubtotal,
    promoPreview,
    hasOverStockItems,
    cartSyncError,
  } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full max-w-md bg-slate-950 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Your Cart</h2>
            <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {cartSyncError && (
          <p role="alert" className="mx-4 mt-3 rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-200">
            {cartSyncError}
          </p>
        )}

        {/* Over-stock global banner if applicable */}
        {hasOverStockItems && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-amber-950/40 border border-amber-600/30 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">Stock Availability Notice</p>
              <p className="mt-0.5 text-amber-200/90 leading-relaxed">
                Reduce quantities to current stock before checkout.
              </p>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Your cart is empty</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Explore our premium tech catalogue to add flagship products.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-all"
              >
                Browse Catalogue
              </button>
            </div>
          ) : (
            items.map(({ product, quantity }) => {
              const isOverStock = quantity > product.stock_quantity;
              return (
                <div
                  key={product.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isOverStock
                      ? 'bg-slate-900/90 border-amber-500/30'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-16 h-16 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">
                        {product.name}
                      </h4>
                      <p className="text-xs text-cyan-400 font-semibold mt-0.5">
                        {formatNaira(product.price)}
                      </p>

                      {/* Over-stock pill */}
                      {isOverStock && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-300 font-medium">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Qty ({quantity}) exceeds available stock ({product.stock_quantity})</span>
                        </div>
                      )}

                      {/* Quantity Controls & Remove */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950">
                          <button
                            onClick={() => updateQuantity(product.id, quantity - 1)}
                            className="p-1 text-slate-400 hover:text-white"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-mono font-medium text-white">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(product.id, quantity + 1)}
                            disabled={quantity >= product.stock_quantity}
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(product.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer & Promo Summary */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 space-y-4">
            
            {/* Promo Live Preview */}
            <div className={`p-3 rounded-xl border text-xs ${
              promoPreview.qualifies
                ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  5% Store-Credit Bonus (₦500k+ orders)
                </span>
                {promoPreview.qualifies ? (
                  <span className="text-cyan-300 font-mono font-bold">
                    +{formatNaira(promoPreview.bonusAmount)}
                  </span>
                ) : (
                  <span className="text-slate-400">Not yet reached</span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-tight">
                {promoPreview.qualifies ? (
                  <span className="text-cyan-300/90 font-medium">
                    Preview: Qualifies for {formatNaira(promoPreview.bonusAmount)} bonus credit (<span className="underline italic">pending until payment is verified</span>). n8n is the authority.
                  </span>
                ) : (
                  <span>
                    Add {formatNaira(promoPreview.remainingToQualify)} more to qualify for a 5% bonus credit (pending verification).
                  </span>
                )}
              </p>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="text-lg font-bold text-white font-mono">
                {formatNaira(cartSubtotal)}
              </span>
            </div>

            {/* Compliance Note */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Submission is not payment. Payment is verified before dispatch.</span>
            </div>

            {/* Checkout CTA */}
            {hasOverStockItems ? (
              <button
                type="button"
                disabled
                title="Reduce quantities to current stock before checkout."
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 text-slate-500 font-bold text-sm cursor-not-allowed"
              >
                <span>Reduce quantities to continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <Link
                href="/checkout"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/20"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
