'use client';

import React, { useState, useMemo } from 'react';
import { Search, Sparkles, Filter, PackageX } from 'lucide-react';
import { Product } from '@/types';
import ProductCard from './ProductCard';
import { formatNaira, PROMO_THRESHOLD } from '@/lib/formatters';

interface CatalogueViewProps {
  initialProducts: Product[];
}

export default function CatalogueView({ initialProducts }: CatalogueViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    initialProducts.forEach((p) => set.add(p.category));
    return ['All', ...Array.from(set)];
  }, [initialProducts]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return initialProducts.filter((product) => {
      // Search match
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query);

      // Category match
      const matchesCategory =
        selectedCategory === 'All' || product.category === selectedCategory;

      // Stock filter
      let matchesStock = true;
      if (stockFilter === 'IN_STOCK') {
        matchesStock = product.stock_quantity > 0;
      } else if (stockFilter === 'LOW_STOCK') {
        matchesStock = product.stock_quantity > 0 && product.stock_quantity <= 3;
      } else if (stockFilter === 'OUT_OF_STOCK') {
        matchesStock = product.stock_quantity === 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [initialProducts, searchTerm, selectedCategory, stockFilter]);

  return (
    <div className="space-y-8">
      {/* Hero Promo Banner */}
      <section className="relative overflow-hidden rounded-3xl p-8 sm:p-10 border border-cyan-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 border border-cyan-800/80 text-cyan-300">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Storewide High-Value Bonus Initiative</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Flagship Hardware. <br />
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
              Zero Guesswork.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Direct Nigerian pricing for enterprise hardware. Orders of <strong className="text-cyan-300">{formatNaira(PROMO_THRESHOLD)} or more</strong> automatically qualify for a <strong className="text-cyan-300">5% store-credit bonus</strong>.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 font-medium">
              ℹ️ Bonus is <span className="text-cyan-300 italic">pending until payment is verified</span>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 font-medium">
              ⚡ Webhook automated order intake
            </span>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-[-10%] top-[-20%] w-[380px] h-[380px] rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      </section>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="catalogue-search-input"
            type="text"
            placeholder="Search laptops, phones, gaming consoles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Stock Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 flex items-center gap-1 font-medium mr-1">
            <Filter className="w-3.5 h-3.5" />
            Stock:
          </span>
          <button
            onClick={() => setStockFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              stockFilter === 'ALL'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            All Stock
          </button>
          <button
            onClick={() => setStockFilter('IN_STOCK')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              stockFilter === 'IN_STOCK'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            In Stock
          </button>
          <button
            onClick={() => setStockFilter('LOW_STOCK')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              stockFilter === 'LOW_STOCK'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Low Stock (≤ 3)
          </button>
          <button
            onClick={() => setStockFilter('OUT_OF_STOCK')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              stockFilter === 'OUT_OF_STOCK'
                ? 'bg-rose-500 text-white font-bold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-slate-100 text-slate-950 shadow-md'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <PackageX className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No products found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query or switching categories to browse available devices.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('All');
              setStockFilter('ALL');
            }}
            className="text-xs text-cyan-400 hover:underline font-semibold"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
