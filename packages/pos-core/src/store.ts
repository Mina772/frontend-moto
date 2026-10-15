import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import type { Customer, ID, LocalizedText, PaymentMethod, PaymentSplit, PriceTier, SalePriceTier, SaleType } from '@moto/shared';
import { PRICE_TIERS, clampPriceTier, defaultTierForCustomer, round2 } from '@moto/shared';

export interface CartLine {
  productId: ID;
  name: LocalizedText;
  barcode: string;
  sku: string;
  partNumber?: string;
  /** Tier price before manual edits / discounts. */
  listPrice: number;
  unitPrice: number;
  unitCost: number;
  priceTier: SalePriceTier;
  quantity: number;
  discountPercent: number;
  available: number;
}

export interface HeldCart {
  id: ID;
  heldAt: string;
  lines: CartLine[];
  customer: Customer | null;
  invoiceDiscount: number;
  note: string;
}

export interface PosState {
  lines: CartLine[];
  customer: Customer | null;
  invoiceDiscount: number;
  saleType: SaleType;
  payments: PaymentSplit[];
  /** Default tier applied to newly added lines. Never leaves `allowedTiers`. */
  priceTier: PriceTier;
  /** Tiers the signed-in user may sell at; set once from their permissions. */
  allowedTiers: PriceTier[];
  /** Tier a cart falls back to when no customer forces one (settings.pos.defaultPriceTier). */
  defaultTier: PriceTier;
  held: HeldCart[];
  lastSaleId: ID | null;
  configureTiers: (opts: { allowedTiers: PriceTier[]; defaultTier: PriceTier }) => void;
  addLine: (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void;
  setQty: (productId: ID, qty: number) => void;
  setLineDiscount: (productId: ID, pct: number) => void;
  setLinePrice: (productId: ID, price: number) => void;
  setLineTier: (productId: ID, tier: SalePriceTier, price: number) => void;
  replaceLine: (productId: ID, line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void;
  removeLine: (productId: ID) => void;
  removeLast: () => void;
  setCustomer: (c: Customer | null) => void;
  setInvoiceDiscount: (v: number) => void;
  setSaleType: (t: SaleType) => void;
  setPriceTier: (m: PriceTier) => void;
  setPayments: (p: PaymentSplit[]) => void;
  setPayment: (method: PaymentMethod, amount: number) => void;
  hold: (note?: string) => void;
  resume: (id: ID) => void;
  dropHeld: (id: ID) => void;
  clear: () => void;
  setLastSale: (id: ID | null) => void;
}

export function createPosStore(storage?: PersistStorage<Partial<PosState>>, name = 'moto-pos') {
  return create<PosState>()(
    persist(
      (set, get) => ({
        lines: [],
        customer: null,
        invoiceDiscount: 0,
        saleType: 'cash',
        payments: [],
        priceTier: 'retail1',
        allowedTiers: [...PRICE_TIERS],
        defaultTier: 'retail1',
        held: [],
        lastSaleId: null,
        configureTiers: ({ allowedTiers, defaultTier }) =>
          set((s) => {
            const allowed = allowedTiers.length ? allowedTiers : [...PRICE_TIERS];
            const fallback = clampPriceTier(defaultTier, allowed);
            // A tier restored from storage may belong to a user who has since signed out.
            return { allowedTiers: allowed, defaultTier: fallback, priceTier: clampPriceTier(s.priceTier, allowed, fallback) };
          }),
        addLine: (line) =>
          set((s) => {
            const existing = s.lines.find((l) => l.productId === line.productId);
            if (existing) return { lines: s.lines.map((l) => (l.productId === line.productId ? { ...l, quantity: l.quantity + (line.quantity ?? 1) } : l)) };
            return { lines: [...s.lines, { ...line, quantity: line.quantity ?? 1 }] };
          }),
        setQty: (productId, qty) => set((s) => ({ lines: qty <= 0 ? s.lines.filter((l) => l.productId !== productId) : s.lines.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)) })),
        setLineDiscount: (productId, pct) => set((s) => ({ lines: s.lines.map((l) => (l.productId === productId ? { ...l, discountPercent: Math.max(0, Math.min(100, pct)) } : l)) })),
        setLinePrice: (productId, price) => set((s) => ({ lines: s.lines.map((l) => (l.productId === productId ? { ...l, unitPrice: Math.max(0, price), priceTier: 'manual' } : l)) })),
        setLineTier: (productId, tier, price) => set((s) => ({ lines: s.lines.map((l) => (l.productId === productId ? { ...l, priceTier: tier, listPrice: price, unitPrice: price } : l)) })),
        replaceLine: (productId, line) =>
          set((s) => {
            const old = s.lines.find((l) => l.productId === productId);
            const qty = line.quantity ?? old?.quantity ?? 1;
            const without = s.lines.filter((l) => l.productId !== productId && l.productId !== line.productId);
            return { lines: [...without, { ...line, quantity: qty }] };
          }),
        removeLine: (productId) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),
        removeLast: () => set((s) => ({ lines: s.lines.slice(0, -1) })),
        setCustomer: (customer) => set((s) => ({ customer, priceTier: clampPriceTier(defaultTierForCustomer(customer?.type, s.defaultTier), s.allowedTiers, s.defaultTier) })),
        setInvoiceDiscount: (invoiceDiscount) => set({ invoiceDiscount: Math.max(0, invoiceDiscount) }),
        setSaleType: (saleType) => set({ saleType, payments: saleType === 'credit' ? [] : get().payments }),
        setPriceTier: (priceTier) => set((s) => ({ priceTier: clampPriceTier(priceTier, s.allowedTiers, s.defaultTier) })),
        setPayments: (payments) => set({ payments }),
        setPayment: (method, amount) =>
          set((s) => {
            const others = s.payments.filter((p) => p.method !== method);
            return { payments: amount > 0 ? [...others, { method, amount }] : others };
          }),
        hold: (note = '') =>
          set((s) =>
            s.lines.length
              ? { held: [...s.held, { id: `H-${Date.now().toString(36).toUpperCase()}`, heldAt: new Date().toISOString(), lines: s.lines, customer: s.customer, invoiceDiscount: s.invoiceDiscount, note }], lines: [], customer: null, invoiceDiscount: 0, payments: [], saleType: 'cash', priceTier: s.defaultTier }
              : s,
          ),
        resume: (id) =>
          set((s) => {
            const h = s.held.find((x) => x.id === id);
            if (!h) return s;
            const remaining = s.held.filter((x) => x.id !== id);
            const current = s.lines.length ? [...remaining, { id: `H-${Date.now().toString(36).toUpperCase()}`, heldAt: new Date().toISOString(), lines: s.lines, customer: s.customer, invoiceDiscount: s.invoiceDiscount, note: '' }] : remaining;
            return { held: current, lines: h.lines, customer: h.customer, invoiceDiscount: h.invoiceDiscount, payments: [], saleType: 'cash', priceTier: clampPriceTier(defaultTierForCustomer(h.customer?.type, s.defaultTier), s.allowedTiers, s.defaultTier) };
          }),
        dropHeld: (id) => set((s) => ({ held: s.held.filter((x) => x.id !== id) })),
        // The next customer must not inherit the previous one's tier.
        clear: () => set((s) => ({ lines: [], customer: null, invoiceDiscount: 0, payments: [], saleType: 'cash', priceTier: s.defaultTier })),
        setLastSale: (lastSaleId) => set({ lastSaleId }),
      }),
      // `storage` must stay off the options object when absent: an explicit `undefined` overwrites zustand's
      // localStorage default and silently disables persistence, losing held invoices on restart.
      { name, ...(storage ? { storage } : {}), partialize: (s) => ({ held: s.held, lines: s.lines, customer: s.customer, invoiceDiscount: s.invoiceDiscount, lastSaleId: s.lastSaleId, priceTier: s.priceTier }) },
    ),
  );
}

export type PosStore = ReturnType<typeof createPosStore>;

/** Server-side discount for one line (must match API createSale: round2 per line). */
export function lineDiscount(l: Pick<CartLine, 'unitPrice' | 'quantity' | 'discountPercent'>) {
  return round2((l.unitPrice * l.quantity * l.discountPercent) / 100);
}

/** Mirrors API createSale totals: per-line rounded discounts, invoice discount, then tax on the taxable amount. */
export function cartTotals(lines: CartLine[], invoiceDiscount: number, invoice: { showTax: boolean; taxRate: number } = { showTax: false, taxRate: 0 }) {
  const subtotal = round2(lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0));
  const itemDiscounts = round2(lines.reduce((a, l) => a + lineDiscount(l), 0));
  const taxable = round2(Math.max(0, subtotal - itemDiscounts - invoiceDiscount));
  const tax = invoice.showTax ? round2((taxable * invoice.taxRate) / 100) : 0;
  const total = round2(taxable + tax);
  const cost = round2(lines.reduce((a, l) => a + l.unitCost * l.quantity, 0));
  const qty = lines.reduce((a, l) => a + l.quantity, 0);
  return { subtotal, itemDiscounts, taxable, tax, total, cost, qty };
}
