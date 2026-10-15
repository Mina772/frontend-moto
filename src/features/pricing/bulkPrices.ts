import type { ProductWithStock } from '@/services/productService';

export async function bulkPriceTargets(
  service: { get(id: string): Promise<ProductWithStock>; all(): Promise<ProductWithStock[]> },
  selection: Record<string, boolean>,
  category: string,
): Promise<ProductWithStock[]> {
  const ids = Object.keys(selection).filter((id) => selection[id]);
  const products = ids.length ? await Promise.all(ids.map((id) => service.get(id))) : await service.all();
  return products.filter((p) => p.isActive && (ids.length || category === 'all' || p.categoryId === category));
}
