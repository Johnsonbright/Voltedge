import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, ArrowLeft, Shield, Zap, RotateCcw } from 'lucide-react';
import { getProductBySlug, getProducts } from '@/lib/products';
import { formatNaira } from '@/lib/formatters';
import ProductDetailActions from '@/components/ProductDetailActions';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 3;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/" className="hover:text-white flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Catalogue
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-slate-400">{product.category}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-white font-medium truncate max-w-[200px] sm:max-w-none">
          {product.name}
        </span>
      </nav>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
        {/* Product Image Column */}
        <div className="space-y-4">
          <div className="relative aspect-[4/3] sm:aspect-square w-full rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl">
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover p-2"
            />

            {/* Floating category pill */}
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-950/85 backdrop-blur-md text-slate-200 border border-slate-700">
                {product.category}
              </span>
            </div>

            {/* Stock pill */}
            <div className="absolute top-4 right-4">
              {isOutOfStock ? (
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-rose-950/90 text-rose-300 border border-rose-800 flex items-center gap-1.5 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  Out of Stock
                </span>
              ) : isLowStock ? (
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-950/90 text-amber-300 border border-amber-800 flex items-center gap-1.5 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Low Stock: Only {product.stock_quantity} units available
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-800 flex items-center gap-1.5 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  In Stock ({product.stock_quantity} available)
                </span>
              )}
            </div>
          </div>

          {/* Value props */}
          <div className="grid grid-cols-3 gap-3 pt-2 text-center">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
              <Shield className="w-4 h-4 mx-auto text-cyan-400" />
              <p className="font-semibold text-white">Genuine Tech</p>
              <p className="text-[10px] text-slate-400">100% Authentic</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
              <Zap className="w-4 h-4 mx-auto text-amber-400" />
              <p className="font-semibold text-white">Lagos Stock</p>
              <p className="text-[10px] text-slate-400">Local Warehouse</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
              <RotateCcw className="w-4 h-4 mx-auto text-emerald-400" />
              <p className="font-semibold text-white">Verified Orders</p>
              <p className="text-[10px] text-slate-400">Manual Review</p>
            </div>
          </div>
        </div>

        {/* Product Details & Actions Column */}
        <div className="space-y-6 flex flex-col justify-center">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
              {product.category}
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              {product.name}
            </h1>
          </div>

          {/* Pricing Banner */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-baseline justify-between">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Standard Retail Price</span>
              <span className="text-3xl font-extrabold text-white font-mono text-cyan-300">
                {formatNaira(product.price)}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              VAT Inclusive (NGN)
            </span>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Product Overview & Specifications
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Interactive Actions (Quantity, Stock Warnings, Add to Cart) */}
          <ProductDetailActions product={product} />
        </div>
      </div>
    </div>
  );
}
