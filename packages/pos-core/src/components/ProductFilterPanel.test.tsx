import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_SETTINGS } from '@moto/shared';
import type { PosProduct } from '../adapter';
import { ProductFilterPanel } from './ProductFilterPanel';

const base = { brandId: 'b1', categoryId: 'c1', supplierId: 's1', purchasePrice: 1, lastPurchaseCost: 1, minStock: 2, unit: { ar: 'قطعة' }, compatibleModelIds: [], alternativeProductIds: [], isActive: true, createdAt: '', updatedAt: '' };
const catalog: PosProduct[] = [
  { ...base, id: 'p1', name: { ar: 'تيل فرامل' }, internalBarcode: 'MP1', sku: 'S1', partNumber: 'P1', prices: { retail1: 85, retail2: 80, wholesale: 70 }, available: 4 },
  { ...base, id: 'p2', name: { ar: 'بوجيه' }, internalBarcode: 'MP2', sku: 'S2', partNumber: 'P2', prices: { retail1: 60, retail2: 55, wholesale: 50 }, available: 0 },
];

describe('ProductFilterPanel', () => {
  it('filters by text and stock, and picks with Enter', () => {
    const onPick = vi.fn();
    render(<ProductFilterPanel catalog={catalog} settings={DEFAULT_SETTINGS} tier="retail1" allowNegative={false} onPick={onPick} />);
    expect(screen.getByText('تيل فرامل')).toBeTruthy();
    expect(screen.getByText('بوجيه').closest('button')!.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: 'نفد' }));
    expect(screen.queryByText('تيل فرامل')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'الكل' }));

    const search = screen.getByLabelText('اسم، كود، رقم قطعة، مقاس…');
    fireEvent.change(search, { target: { value: 'تيل' } });
    expect(screen.queryByText('بوجيه')).toBeNull();
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(catalog[0]);
  });
});
