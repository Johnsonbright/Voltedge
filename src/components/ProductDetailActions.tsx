'use client';

import React, { useState } from 'react';
import { ShoppingCart, Check, AlertTriangle, ShieldCheck, Sparkles, Plus, Minus } from 'lucide-react';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { formatNaira, PROMO_THRESHOLD, PROMO_PERCENTAGE } from '@/lib/formatters';

interface ProductDetailActionsProps {
  product: Product;
}

export default function ProductDetailActions({ product }: ProductDetailActionsProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isOutOfStock = product.stock_quantity <= 0;
  const isOverStock = quantity > product.stock_quantity;
  const lineTotal = product.price * quantity;
  const qualifiesForPromo = lineTotal >= PROMO_THRESHOLD;
  const bonusPreview = qualifiesForPromo ? Math.round(lineTotal * PROMO_PERCENTAGE) : 0;

  const handleIncrement = () => setQuantity((q) => q + 1);
  const handleDecrement = () => setQuantity((q) => Math.max(1, q - 1));

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    const result = addItem(product, quantity);
    setJustAdded(true);
    if (result.message) {
      setToastMessage(result.message);
    } else {
      setToastMessage(`Added ${quantity} × ${product.name} to cart.`);
    }

    setTimeout(() => {
      setJustAdded(false);
      setToastMessage(null);
    }, 3500);
  };

  return (
    <div className="space-y-6">
      {/* Over-stock or Out-of-stock Warnings */}
      {isOutOfStock ? (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-300">Currently Out of Stock</p>
            <p className="mt-0.5 text-rose-200/80 leading-relaxed">
              This unit is currently sold out in our warehouse. Please check back later or explore alternative models in the catalogue.
            </p>
          </div>
        </div>
      ) : isOverStock ? (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-300">Subject to Availability Review</p>
            <p className="mt-0.5 text-amber-200/90 leading-relaxed">
              Requested quantity ({quantity}) exceeds currently verified shelf stock ({product.stock_quantity}). You may still place the order; it will be flagged for manual inventory review rather than blocked.
            </p>
          </div>
        </div>
      ) : null}

      {/* Promo Notification if line qualifies */}
      {qualifiesForPromo && (
        <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-cyan-300">High-Value Promo Preview: </span>
            This order amount qualifies for a 5% bonus credit ({formatNaira(bonusPreview)}), <span className="underline italic">pending until payment is verified</span>.
          </div>
        </div>
      )}

      {/* Quantity & CTA Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        {/* Quantity Stepper */}
        {!isOutOfStock && (
          <div className="flex items-center justify-between sm:justify-start border border-slate-800 bg-slate-900 rounded-xl px-2 py-1.5 shrink-0">
            <button
              onClick={handleDecrement}
              disabled={quantity <= 1}
              className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-4 text-sm font-mono font-bold text-white min-w-[2.5rem] text-center">
              {quantity}
            </span>
            <button
              onClick={handleIncrement}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            isOutOfStock
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40'
              : justAdded
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-98'
          }`}
        >
          {isOutOfStock ? (
            <span>Unavailable (Out of Stock)</span>
          ) : justAdded ? (
            <>
              <Check className="w-4 h-4" />
              <span>Added to Cart ({quantity})</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              <span>Add to Cart • {formatNaira(lineTotal)}</span>
            </>
          )}
        </button>
      </div>

      {/* Feedback Alert */}
      {toastMessage && (
        <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-3.5 h-3.5 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Honest Retail Commitment */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">VoltEdge Honest Checkout Guarantee</span>
        </div>
        <p className="leading-relaxed">
          Submitting an order does not process an instant charge or guarantee stock reservation. Our Lagos team validates warehouse inventory and issues secure verified payment instructions.
        </p>
      </div>
    </div>
  );
}
