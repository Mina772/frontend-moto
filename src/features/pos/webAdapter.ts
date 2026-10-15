import type { ConnectivityState, PosAdapter, PosProduct } from '@moto/pos-core';
import { pageStyleFor } from '@moto/pos-core';
import type { ID, Locale, Permission, PrintProfile, User } from '@/types';
import { PAPER_SIZES, uuid } from '@moto/shared';
import { api, devicePrintPref } from '@/services';
import type { ProductWithStock } from '@/services/productService';

const toPos = (p: ProductWithStock, branchId: ID): PosProduct => ({ ...p, available: p.saleStock ?? p.branchStock[branchId] ?? 0, location: p.saleLocation });

interface WebPosAdapterOptions {
  user: User;
  permissions: Permission[];
  branchId: ID;
  locale: Locale;
  navigate: (path: string) => void;
  branchName: (id: ID) => string;
  openCustomerDisplay?: () => Promise<void>;
  refresh?: () => Promise<void>;
}

/** POS adapter for the browser: every write goes straight to the REST API; prints via window.print(). */
export function createWebPosAdapter(opts: WebPosAdapterOptions): PosAdapter {
  const { user, permissions, branchId, locale, navigate, branchName } = opts;

  // The browser has no outbox, so connectivity is just the network flag the terminal badge reads.
  let state: ConnectivityState = { online: navigator.onLine, syncing: false, pending: 0, rejected: 0, lastSyncAt: null };
  const listeners = new Set<(s: ConnectivityState) => void>();
  const setOnline = (online: boolean) => {
    state = { ...state, online };
    listeners.forEach((fn) => fn(state));
  };

  /** The drawer endpoint returns the movement, not the session the terminal re-renders from. */
  const session = () => api.cash.currentSession(branchId);

  return {
    user,
    permissions,
    branchId,
    locale,
    settings: () => api.settings.get(),
    lookup: async (term) => {
      const res = await api.products.lookupWithHint(term, branchId, 12);
      return { products: res.products.map((p) => toPos(p, branchId)), legacyHit: res.legacyHit };
    },
    product: async (id) => {
      const p = await api.products.get(id, branchId).catch(() => null);
      return p ? toPos(p, branchId) : null;
    },
    customers: () => api.customers.all(),
    createCustomer: (input) => api.customers.save(input, uuid()),
    specialPrices: () => api.customers.specialPrices(),
    quickGrid: async () => {
      const [products, categories, catalog] = await Promise.all([api.quick.products(branchId), api.quick.categories(branchId), api.products.all(branchId)]);
      return { products, categories, catalog: catalog.map((p) => toPos(p, branchId)) };
    },
    catalogMeta: async () => {
      const [categories, brands, models] = await Promise.all([api.products.categories(), api.products.brands(), api.products.models()]);
      return { categories, brands, models };
    },
    saveQuickProduct: (input) => api.quick.saveProduct(input),
    deleteQuickProduct: async (id) => {
      await api.quick.deleteProduct(id);
    },
    reorderQuick: async (ids) => {
      await api.quick.reorder(ids);
    },
    currentSession: session,
    createSale: (input) => api.sales.create(input, uuid()),
    lastSale: (id) => api.sales.get(id).catch(() => null),
    saleByInvoice: (invoiceNumber) => api.sales.findByInvoiceNumber(invoiceNumber).catch(() => null),
    recentSales: async (limit = 30) => {
      // No sortBy: the route already defaults to newest-first, and an unknown field silently sorts by insertion order.
      const page = await api.sales.list({ branchId, pageSize: limit });
      return page.data;
    },
    createSaleReturn: (input) => api.sales.createReturn(input, uuid()),
    cashMovement: async (input) => {
      const open = await session();
      if (!open) throw new Error('NO_OPEN_SESSION');
      await api.cash.addMovement(open.id, input, uuid());
      return (await session()) ?? open;
    },
    collectDebt: (input) => api.customers.recordPayment({ customerId: input.customerId, debtId: null, amount: input.amount, method: input.method, reference: '', branchId, notes: input.notes }, uuid()),
    branchName,
    alternatives: (productId) => api.products.alternatives(productId, branchId, false),
    requestTransfer: async (productId, fromBranchId, qty) => {
      await api.inventory.createTransfer({ sourceBranchId: fromBranchId, destinationBranchId: branchId, items: [{ productId, requestedQty: qty }], submit: true });
    },
    printProfiles: () => api.settings.printProfiles(branchId),
    getDevicePrintProfile: () => devicePrintPref.get(),
    setDevicePrintProfile: (id) => devicePrintPref.set(id),
    print: async (el: HTMLElement | null, profile: PrintProfile | null) => {
      // The terminal mounts the receipt in `.print-area`; index.css hides everything else while printing.
      await new Promise((r) => setTimeout(r, 50));
      if (!el || !profile) throw new Error(locale === 'ar' ? 'تعذّر تجهيز محتوى الفاتورة للطباعة' : 'Invoice content is not ready to print');
      const paper = PAPER_SIZES[profile.paper];
      const heightMm = paper.heightMm === 'auto' ? Math.max(30, Math.ceil(el.getBoundingClientRect().height * 25.4 / 96 + 4)) : undefined;
      const style = document.createElement('style');
      style.textContent = pageStyleFor(profile, heightMm);
      document.body.appendChild(style);
      try {
        window.print();
      } finally {
        style.remove();
      }
    },
    navigate,
    openCustomerDisplay: opts.openCustomerDisplay,
    syncNow: opts.refresh ? async () => {
      state = { ...state, syncing: true };
      listeners.forEach((fn) => fn(state));
      try { await opts.refresh!(); }
      finally {
        state = { ...state, syncing: false };
        listeners.forEach((fn) => fn(state));
      }
    } : undefined,
    offlineNotice: locale === 'ar' ? 'غير متصل — إتمام البيع يحتاج اتصالاً بالإنترنت. السلة والفواتير المعلقة محفوظة على هذا الجهاز.' : 'Offline — checkout requires an internet connection. Your cart and held invoices are saved on this device.',
    connectivity: () => state,
    subscribeConnectivity: (fn) => {
      listeners.add(fn);
      state = { ...state, online: navigator.onLine };
      fn(state);
      const on = () => setOnline(true);
      const off = () => setOnline(false);
      window.addEventListener('online', on);
      window.addEventListener('offline', off);
      return () => {
        listeners.delete(fn);
        window.removeEventListener('online', on);
        window.removeEventListener('offline', off);
      };
    },
  };
}
