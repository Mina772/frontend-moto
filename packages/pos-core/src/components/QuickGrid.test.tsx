import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_SETTINGS } from '@moto/shared';
import type { QuickCategory, QuickProduct } from '@moto/shared';
import type { PosProduct } from '../adapter';
import { QuickGrid } from './QuickGrid';

const base = { brandId: 'b1', categoryId: 'c1', supplierId: 's1', purchasePrice: 1, lastPurchaseCost: 1, minStock: 2, unit: { ar: 'قطعة' }, compatibleModelIds: [], alternativeProductIds: [], isActive: true, createdAt: '', updatedAt: '' };
const catalog: PosProduct[] = [
  { ...base, id: 'p1', name: { ar: 'تيل فرامل أمامي' }, internalBarcode: 'MP1', sku: 'S1', partNumber: 'P1', prices: { retail1: 85, retail2: 80, wholesale: 70 }, available: 4 },
  { ...base, id: 'p2', name: { ar: 'بوجيه NGK' }, internalBarcode: 'MP2', sku: 'S2', partNumber: 'P2', prices: { retail1: 60, retail2: 55, wholesale: 50 }, available: 7 },
  { ...base, id: 'p3', name: { ar: 'زيت محرك' }, internalBarcode: 'MP3', sku: 'S3', partNumber: 'P3', prices: { retail1: 120, retail2: 115, wholesale: 100 }, available: 0 },
];
const quick: QuickProduct[] = [
  { id: 'q1', productId: 'p1', categoryId: 'qc1', branchId: null, order: 0 },
  { id: 'q2', productId: 'p2', categoryId: 'qc1', branchId: null, order: 1 },
  { id: 'q3', productId: 'p3', categoryId: 'qc2', branchId: null, order: 2 },
];
const categories: QuickCategory[] = [
  { id: 'qc1', name: { ar: 'فرامل' }, order: 0, branchId: null },
  { id: 'qc2', name: { ar: 'زيوت' }, order: 1, branchId: null },
];

const noop = async () => undefined;
const renderGrid = (props: Partial<React.ComponentProps<typeof QuickGrid>> = {}) =>
  render(
    <QuickGrid
      quick={quick}
      categories={categories}
      catalog={catalog}
      settings={DEFAULT_SETTINGS}
      tier="retail1"
      canEdit={false}
      allowNegative={false}
      onPick={vi.fn()}
      onSave={noop}
      onDelete={noop}
      onReorder={noop}
      lookup={async () => []}
      {...props}
    />,
  );

describe('QuickGrid', () => {
  it('shows product codes and part numbers directly on the tiles', () => {
    renderGrid();
    const tile = screen.getByText('تيل فرامل أمامي').closest('button')!;
    expect(tile.textContent).toContain('S1');
    expect(tile.textContent).toContain('MP1');
    expect(tile.textContent).toContain('P1');
  });
  it('searches inside the grid by product name', () => {
    renderGrid();
    expect(screen.getByText('بوجيه NGK')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('بحث في الأصناف السريعة'), { target: { value: 'فرامل' } });
    expect(screen.getByText('تيل فرامل أمامي')).toBeTruthy();
    expect(screen.queryByText('بوجيه NGK')).toBeNull();
  });

  it('searches by sku and barcode too', () => {
    renderGrid();
    fireEvent.change(screen.getByLabelText('بحث في الأصناف السريعة'), { target: { value: 'MP3' } });
    expect(screen.getByText('زيت محرك')).toBeTruthy();
    expect(screen.queryByText('تيل فرامل أمامي')).toBeNull();
  });

  it('shows a clear message when the search matches nothing', () => {
    renderGrid();
    fireEvent.change(screen.getByLabelText('بحث في الأصناف السريعة'), { target: { value: 'لا يوجد' } });
    expect(screen.getByText('لم يتم العثور على صنف')).toBeTruthy();
  });

  it('keeps the category tabs working alongside search', () => {
    renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'زيوت' }));
    expect(screen.getByText('زيت محرك')).toBeTruthy();
    expect(screen.queryByText('بوجيه NGK')).toBeNull();
  });

  it('toggles fullscreen through the callback and enlarges the tiles', () => {
    const onToggleFullscreen = vi.fn();
    const { rerender } = renderGrid({ onToggleFullscreen });
    fireEvent.click(screen.getByLabelText('شاشة كاملة'));
    expect(onToggleFullscreen).toHaveBeenCalled();

    rerender(
      <QuickGrid
        quick={quick}
        categories={categories}
        catalog={catalog}
        settings={DEFAULT_SETTINGS}
        tier="retail1"
        canEdit={false}
        allowNegative={false}
        fullscreen
        onToggleFullscreen={onToggleFullscreen}
        onPick={vi.fn()}
        onSave={noop}
        onDelete={noop}
        onReorder={noop}
        lookup={async () => []}
      />,
    );
    expect(screen.getByLabelText('إنهاء الشاشة الكاملة')).toBeTruthy();
    expect(screen.getByText('تيل فرامل أمامي').closest('button')!.className).toContain('min-h-40');
  });

  it('picks a product and refuses out-of-stock tiles', () => {
    const onPick = vi.fn();
    renderGrid({ onPick });
    fireEvent.click(screen.getByText('تيل فرامل أمامي').closest('button')!);
    expect(onPick).toHaveBeenCalledWith(catalog[0]);

    fireEvent.click(screen.getByRole('button', { name: 'زيوت' }));
    expect(screen.getByText('زيت محرك').closest('button')!.hasAttribute('disabled')).toBe(true);
  });
});
