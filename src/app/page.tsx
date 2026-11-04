import { getProducts } from '@/lib/products';
import CatalogueView from '@/components/CatalogueView';

export default async function HomePage() {
  const products = await getProducts();

  return (
    <main className="space-y-12">
      <CatalogueView initialProducts={products} />
    </main>
  );
}
