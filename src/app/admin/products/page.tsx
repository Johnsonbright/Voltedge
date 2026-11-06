'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, X } from 'lucide-react';
import Image from 'next/image';
import { adminFetch } from '@/lib/adminClient';
import { formatNaira } from '@/lib/formatters';
import { Product } from '@/types';

type ProductForm = {
  id?: string;
  slug: string;
  name: string;
  price: string;
  stock_quantity: string;
  image_url: string;
  description: string;
  category: string;
  is_active: boolean;
};

const emptyForm: ProductForm = {
  slug: '',
  name: '',
  price: '',
  stock_quantity: '0',
  image_url: '',
  description: '',
  category: '',
  is_active: true,
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestProducts = useCallback(async () => {
    try {
      const response = await adminFetch('/api/admin/products');
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load products.');
      }
      setProducts(data.products);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load the protected catalogue after this page mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void requestProducts();
  }, [requestProducts]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    await requestProducts();
  };

  const editProduct = (product: Product) => {
    setForm({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      image_url: product.image_url,
      description: product.description,
      category: product.category,
      is_active: product.is_active,
    });
    setNotice(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const payload = {
      ...form,
      price: Number(form.price),
      stock_quantity: Number(form.stock_quantity),
    };

    try {
      const response = await adminFetch('/api/admin/products', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to save product.');
      }
      setForm(emptyForm);
      setNotice(form.id ? 'Product updated.' : 'Product added.');
      await loadProducts();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  const deactivateProduct = async (product: Product) => {
    if (!window.confirm(`Remove "${product.name}" from the storefront? It will be deactivated, not erased.`)) {
      return;
    }

    setError(null);
    setNotice(null);
    try {
      const response = await adminFetch('/api/admin/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to deactivate product.');
      }
      setNotice(`${product.name} was removed from the storefront.`);
      await loadProducts();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to deactivate product.');
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Permanently delete "${product.name}"? Historical order items will be retained.`)) return;
    setError(null);
    setNotice(null);
    try {
      const response = await adminFetch('/api/admin/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, permanent: true }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to delete product.');
      setNotice(`${product.name} was permanently deleted.`);
      await loadProducts();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete product.');
    }
  };

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await adminFetch('/api/admin/products/images', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to upload image.');
      setForm((current) => ({ ...current, image_url: data.image_url }));
      setNotice('Image uploaded to Supabase Storage.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">Catalogue</p>
          <h1 className="text-2xl font-bold text-white mt-1">Manage products</h1>
          <p className="text-sm text-slate-400 mt-1">Prices and stock are saved directly to Supabase.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadProducts()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-900 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {error && <p role="alert" className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-sm text-emerald-200">{notice}</p>}

      <form onSubmit={submitProduct} className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{form.id ? 'Edit product' : 'Add product'}</h2>
          {form.id ? (
            <button type="button" onClick={() => setForm(emptyForm)} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
              <X className="w-4 h-4" /> Cancel edit
            </button>
          ) : <Plus className="w-5 h-5 text-cyan-400" />}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-slate-300">Product name
            <input required minLength={2} maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Slug (lowercase, hyphen-separated)
            <input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={120} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Price (₦)
            <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Stock quantity
            <input required type="number" min="0" step="1" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Category
            <input required maxLength={120} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
          </label>
          <div className="text-xs text-slate-300">
            <label htmlFor="product-image-upload">Product image (JPEG, PNG, WebP, or AVIF; max 5 MB)</label>
            <input
              id="product-image-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required={!form.image_url}
              disabled={uploadingImage}
              onChange={(event) => void uploadImage(event.target.files?.[0])}
              className="mt-1.5 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:text-slate-200"
            />
            {uploadingImage && <span className="block mt-1 text-cyan-300">Uploading image...</span>}
            {form.image_url && (
              <span className="mt-2 flex items-center gap-3">
                <span className="relative block h-14 w-14 overflow-hidden rounded-lg border border-slate-700">
                  <Image src={form.image_url} alt="Product image preview" fill unoptimized className="object-cover" />
                </span>
                <span className="break-all text-[10px] text-slate-500">{form.image_url}</span>
              </span>
            )}
          </div>
        </div>
        <label className="block text-xs text-slate-300">Description
          <textarea required maxLength={5000} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white" />
        </label>
        {form.id && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Visible in storefront
          </label>
        )}
        <button type="submit" disabled={saving} className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 px-4 py-2.5 text-sm font-bold text-slate-950">
          {saving ? 'Saving...' : form.id ? 'Save changes' : 'Add product'}
        </button>
      </form>

      <section className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">Products ({products.length})</h2>
        </div>
        {loading ? <p className="p-5 text-sm text-slate-400">Loading products...</p> : products.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No products found in Supabase.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {products.map((product) => (
              <div key={product.id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">{product.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${product.is_active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                      {product.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{product.slug} · {product.category} · Stock: {product.stock_quantity} · {formatNaira(product.price)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => editProduct(product)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {product.is_active && (
                    <button type="button" onClick={() => void deactivateProduct(product)} className="rounded-lg border border-rose-900/70 px-3 py-2 text-xs text-rose-300 hover:bg-rose-950/50">
                      Deactivate
                    </button>
                  )}
                  <button type="button" onClick={() => void deleteProduct(product)} className="rounded-lg border border-rose-950 px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/50">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
