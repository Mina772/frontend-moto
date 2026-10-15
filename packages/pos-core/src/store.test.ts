import { describe, expect, it } from 'vitest';
import type { Customer } from '@moto/shared';
import { allowedPriceTiers, resolveSalePrice } from '@moto/shared';
import { cartTotals, createPosStore, type CartLine } from './store';

const line = (over: Partial<CartLine> = {}): Omit<CartLine, 'quantity'> & { quantity?: number } => ({
  productId: 'p1',
  name: { ar: 'فلتر' },
  barcode: '2000000000017',
  sku: 'SKU-1',
  listPrice: 100,
  unitPrice: 100,
  unitCost: 50,
  priceTier: 'retail1',
  discountPercent: 0,
  available: 10,
  ...over,
});
const customer = (type: Customer['type']): Customer => ({ id: 'c1', code: 'C1', name: { ar: 'عميل' }, phone: '0100', whatsapp: '0100', address: { ar: '' }, type, creditLimit: 0, balance: 0, branchId: 'br-1', isActive: true, createdAt: '', updatedAt: '' });

describe('pos store — cart & tiers', () => {
  it('adds lines, merges duplicates by quantity, and removes at qty 0', () => {
    const s = createPosStore(undefined, 'test-1');
    s.getState().addLine(line());
    s.getState().addLine(line({ quantity: 2 }));
    expect(s.getState().lines).toHaveLength(1);
    expect(s.getState().lines[0]!.quantity).toBe(3);
    s.getState().setQty('p1', 0);
    expect(s.getState().lines).toHaveLength(0);
  });

  it('switching a line tier updates both list and unit price; manual edit marks tier "manual"', () => {
    const s = createPosStore(undefined, 'test-2');
    s.getState().addLine(line());
    s.getState().setLineTier('p1', 'wholesale', 80);
    expect(s.getState().lines[0]).toMatchObject({ priceTier: 'wholesale', listPrice: 80, unitPrice: 80 });
    s.getState().setLinePrice('p1', 75);
    expect(s.getState().lines[0]).toMatchObject({ priceTier: 'manual', listPrice: 80, unitPrice: 75 });
  });

  it('selecting a customer picks the default tier by customer type', () => {
    const s = createPosStore(undefined, 'test-3');
    s.getState().configureTiers({ allowedTiers: allowedPriceTiers(true), defaultTier: 'retail1' });
    s.getState().setCustomer(customer('wholesale'));
    expect(s.getState().priceTier).toBe('wholesale');
    s.getState().setCustomer(customer('workshop'));
    expect(s.getState().priceTier).toBe('retail2');
    s.getState().configureTiers({ allowedTiers: allowedPriceTiers(true), defaultTier: 'retail2' });
    s.getState().setCustomer(customer('retail'));
    expect(s.getState().priceTier).toBe('retail2');
    s.getState().configureTiers({ allowedTiers: allowedPriceTiers(true), defaultTier: 'retail1' });
    s.getState().setCustomer(null);
    expect(s.getState().priceTier).toBe('retail1');
  });

  it('never selects a tier the user may not sell at', () => {
    const s = createPosStore(undefined, 'test-3b');
    s.getState().configureTiers({ allowedTiers: allowedPriceTiers(false), defaultTier: 'retail1' });
    // A wholesale customer must not silently arm a wholesale price the cashier cannot charge.
    s.getState().setCustomer(customer('wholesale'));
    expect(s.getState().priceTier).toBe('retail1');
    s.getState().setPriceTier('wholesale');
    expect(s.getState().priceTier).toBe('retail1');
    s.getState().setPriceTier('retail2');
    expect(s.getState().priceTier).toBe('retail2');
  });

  it('re-configuring demotes a tier restored from storage that the new user cannot use', () => {
    const s = createPosStore(undefined, 'test-3c');
    s.getState().configureTiers({ allowedTiers: allowedPriceTiers(true), defaultTier: 'retail1' });
    s.getState().setPriceTier('wholesale');
    expect(s.getState().priceTier).toBe('wholesale');
    s.getState().configureTiers({ allowedTiers: allowedPriceTiers(false), defaultTier: 'retail2' });
    expect(s.getState().priceTier).toBe('retail2');
  });

  it('clearing the cart drops the previous customer tier', () => {
    const s = createPosStore(undefined, 'test-3d');
    s.getState().configureTiers({ allowedTiers: allowedPriceTiers(true), defaultTier: 'retail1' });
    s.getState().setCustomer(customer('wholesale'));
    expect(s.getState().priceTier).toBe('wholesale');
    s.getState().clear();
    expect(s.getState().customer).toBeNull();
    expect(s.getState().priceTier).toBe('retail1');
  });

  it('hold / resume round-trips the cart and clears the active one', () => {
    const s = createPosStore(undefined, 'test-4');
    s.getState().addLine(line());
    s.getState().setInvoiceDiscount(5);
    s.getState().hold('later');
    expect(s.getState().lines).toHaveLength(0);
    expect(s.getState().held).toHaveLength(1);
    s.getState().resume(s.getState().held[0]!.id);
    expect(s.getState().lines).toHaveLength(1);
    expect(s.getState().invoiceDiscount).toBe(5);
    expect(s.getState().held).toHaveLength(0);
  });

  it('persists the cart so a held invoice survives an app restart', () => {
    const first = createPosStore(undefined, 'test-persist');
    first.getState().addLine(line());
    first.getState().hold('later');
    first.getState().addLine(line({ productId: 'p2' }));
    expect(localStorage.getItem('test-persist')).toBeTruthy();

    const restarted = createPosStore(undefined, 'test-persist');
    expect(restarted.getState().held).toHaveLength(1);
    expect(restarted.getState().held[0]!.note).toBe('later');
    expect(restarted.getState().lines.map((l) => l.productId)).toEqual(['p2']);
  });

  it('credit sale type clears payments; setPayment upserts by method', () => {
    const s = createPosStore(undefined, 'test-5');
    s.getState().setPayment('cash', 50);
    s.getState().setPayment('card', 20);
    s.getState().setPayment('cash', 30);
    expect(s.getState().payments).toEqual([{ method: 'card', amount: 20 }, { method: 'cash', amount: 30 }]);
    s.getState().setSaleType('credit');
    expect(s.getState().payments).toEqual([]);
  });
});

describe('cartTotals', () => {
  it('applies line discounts then invoice discount, never below zero, with 2dp rounding', () => {
    const lines: CartLine[] = [
      { ...line(), quantity: 3, unitPrice: 33.333, discountPercent: 10 },
      { ...line({ productId: 'p2', unitPrice: 20, unitCost: 10 }), quantity: 1 },
    ];
    const t = cartTotals(lines, 5);
    expect(t.subtotal).toBe(120);
    expect(t.itemDiscounts).toBe(10);
    expect(t.total).toBe(105);
    expect(t.cost).toBe(160);
    expect(t.qty).toBe(4);
    expect(cartTotals(lines, 1000).total).toBe(0);
  });

  it('adds tax on the taxable amount when showTax is on and rounds each line discount like the server', () => {
    const lines: CartLine[] = [
      { ...line({ unitPrice: 10.005 }), quantity: 1, discountPercent: 10 },
      { ...line({ productId: 'p2', unitPrice: 10.005 }), quantity: 1, discountPercent: 10 },
    ];
    const t = cartTotals(lines, 0, { showTax: true, taxRate: 14 });
    expect(t.itemDiscounts).toBe(2);
    expect(t.taxable).toBe(18.01);
    expect(t.tax).toBe(2.52);
    expect(t.total).toBe(20.53);
    expect(cartTotals(lines, 0).tax).toBe(0);
  });
});

describe('resolveSalePrice', () => {
  const product = { prices: { retail1: 100, retail2: 90, wholesale: 80 } };
  it('special price wins over tier', () => {
    expect(resolveSalePrice({ product, tier: 'wholesale', specialPrice: 70 })).toEqual({ price: 70, tier: 'special' });
  });
  it('otherwise returns the requested tier price', () => {
    expect(resolveSalePrice({ product, tier: 'retail2' })).toEqual({ price: 90, tier: 'retail2' });
  });
});
