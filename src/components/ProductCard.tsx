'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Check, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Product } from '@/types';
import { formatNaira } from '@/lib/formatters';
import { useCart } from '@/context/CartContext';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, items } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isOutOfStock = product.stock_quantity <= 0;
  const cartQuantity = items.find((item) => item.product.id === product.id)?.quantity || 0;
  const isAtStockLimit = cartQuantity >= product.stock_quantity;
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 3;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isOutOfStock || isAtStockLimit) return;

    const result = addItem(product, 1);
    if (!result.success) {
      setFeedback(result.message || 'This quantity is unavailable.');
      return;
    }
    setJustAdded(true);
    if (result.message) {
      setFeedback(result.message);
    }
    setTimeout(() => {
      setJustAdded(false);
      setFeedback(null);
    }, 2500);
  };

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col justify-between group relative overflow-hidden">
      {/* Top Media & Badges */}
      <div>
        <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 mb-4">
          <Link href={`/products/${product.slug}`}>
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </Link>

          {/* Category Pill */}
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-slate-950/80 backdrop-blur-md text-slate-300 border border-slate-700/60">
              {product.category}
            </span>
          </div>

          {/* Stock Badge */}
          <div className="absolute top-3 right-3">
            {isOutOfStock ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-950/90 text-rose-300 border border-rose-800/80 flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/90 text-amber-300 border border-amber-800/80 flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Only {product.stock_quantity} left
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-800/80 flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                In Stock ({product.stock_quantity})
              </span>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <Link href={`/products/${product.slug}`} className="group-hover:text-cyan-400 transition-colors">
            <h3 className="font-semibold text-base text-white line-clamp-1 flex items-center justify-between">
              {product.name}
              <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400 shrink-0" />
            </h3>
          </Link>
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>
      </div>

      {/* Pricing & Add to Cart Action */}
      <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
            Retail Price
          </span>
          <span className="text-lg font-bold text-white font-mono tracking-tight text-cyan-300">
            {formatNaira(product.price)}
          </span>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock || isAtStockLimit}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
            isOutOfStock || isAtStockLimit
              ? 'bg-slate-800/60 text-slate-400 border border-slate-700/50 cursor-not-allowed'
              : justAdded
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20 active:scale-95'
          }`}
          aria-label={isOutOfStock ? `${product.name} is out of stock` : isAtStockLimit ? `${product.name} has reached its stock limit in your cart` : `Add ${product.name} to cart`}
        >
          {isOutOfStock ? (
            <span>Sold Out</span>
          ) : isAtStockLimit ? (
            <span>Stock Limit Reached</span>
          ) : justAdded ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Added</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Add to Cart</span>
            </>
          )}
        </button>
      </div>

      {/* Floating availability notification */}
      {feedback && (
        <div className="absolute inset-x-2 bottom-2 p-2.5 rounded-xl bg-amber-950/95 border border-amber-600/60 text-amber-200 text-xs flex items-center gap-2 shadow-xl animate-fade-in">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="line-clamp-2">{feedback}</span>
        </div>
      )}
    </div>
  );
}
