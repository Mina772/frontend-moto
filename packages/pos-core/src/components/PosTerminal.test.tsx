import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ALL_PERMISSIONS, DEFAULT_SETTINGS, defaultPrintProfiles } from '@moto/shared';
import type { RegisterSession, Sale, User } from '@moto/shared';
import { TooltipProvider } from '@moto/ui';
import type { PosAdapter, PosProduct } from '../adapter';
import { createPosStore, type PosStore } from '../store';
import { PosTerminal } from './PosTerminal';
import { toast } from 'sonner';

const user: User = {
  id: 'u1', username: 'cashier', fullName: { ar: 'كاشير' }, email: '', phone: '', role: 'cashier',
  branchId: 'br1', status: 'active', avatarColor: '#000', lastLogin: null, createdAt: '2026-01-01T00:00:00.000Z',
};

const product: PosProduct = {
  id: 'p1', name: { ar: 'تيل فرامل' }, internalBarcode: 'MP1', sku: 'S1', partNumber: 'P1',
  brandId: 'b1', categoryId: 'c1', supplierId: '', purchasePrice: 40, lastPurchaseCost: 40, minStock: 2,
  unit: { ar: 'قطعة' }, compatibleModelIds: [], alternativeProductIds: [], isActive: true,
  createdAt: '', updatedAt: '', prices: { retail1: 100, retail2: 90, wholesale: 80 }, available: 10,
};

const session: RegisterSession = {
  id: 'sess1', registerId: 'r1', branchId: 'br1', userId: 'u1', openedAt: '2026-01-01T00:00:00.000Z', closedAt: null,
  openingBalance: 0, cashSales: 0, cardSales: 0, transferSales: 0, paymentsIn: 0, paymentsOut: 0, expenses: 0,
  refunds: 0, expectedCash: 0, actualCash: null, difference: null, status: 'open', movements: [],
};

const sale: Sale = {
  id: 's1', invoiceNumber: 'INV-1', date: '2026-01-01T00:00:00.000Z', branchId: 'br1', cashierId: 'u1',
  customerId: null, registerSessionId: 'sess1', items: [], subtotal: 100, itemDiscounts: 0, invoiceDiscount: 0,
  tax: 0, total: 100, paid: 100, remaining: 0, change: 0, payments: [{ method: 'cash', amount: 100 }],
  type: 'cash', status: 'completed',
};

function fakeAdapter(over: Partial<PosAdapter> = {}): PosAdapter {
  return {
    user,
    permissions: [...ALL_PERMISSIONS],
    branchId: 'br1',
    locale: 'ar',
    settings: async () => DEFAULT_SETTINGS,
    lookup: async () => ({ products: [], legacyHit: false }),
    product: async () => product,
    customers: async () => [],
    createCustomer: async () => {
      throw new Error('not used');
    },
    specialPrices: async () => [],
    quickGrid: async () => ({ products: [], categories: [], catalog: [product] }),
    saveQuickProduct: async () => {
      throw new Error('not used');
    },
    deleteQuickProduct: async () => undefined,
    reorderQuick: async () => undefined,
    currentSession: async () => session,
    createSale: async () => {
      throw new Error('not used');
    },
    lastSale: async () => null,
    alternatives: async () => [],
    printProfiles: async () => [],
    getDevicePrintProfile: () => null,
    setDevicePrintProfile: () => undefined,
    print: async () => undefined,
    navigate: vi.fn(),
    connectivity: () => ({ online: true, syncing: false, pending: 0, rejected: 0, lastSyncAt: null }),
    subscribeConnectivity: () => () => undefined,
    ...over,
  };
}

async function mount(store: PosStore, over: Partial<PosAdapter> = {}, printOnComplete = true, suspended = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <PosTerminal adapter={fakeAdapter(over)} store={store} printOnComplete={printOnComplete} suspended={suspended} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText('إتمام البيع')).toBeTruthy());
}

async function openPayment() {
  fireEvent.click(screen.getByText('إتمام البيع'));
  await waitFor(() => expect(screen.getByText('إتمام الدفع')).toBeTruthy());
}

function cartStore() {
  // The store persists to localStorage, so a stale `held` list would leak into the next test.
  localStorage.clear();
  const store = createPosStore();
  store.getState().addLine({
    productId: product.id, name: product.name, barcode: product.internalBarcode, sku: product.sku,
    partNumber: product.partNumber, listPrice: 100, unitPrice: 100, unitCost: 40, priceTier: 'retail1',
    discountPercent: 0, quantity: 1, available: 10,
  });
  return store;
}

describe('PosTerminal shortcuts', () => {
  beforeEach(() => localStorage.clear());

  it('preserves the cart and ignores scanner input behind the host lock or shift dialog', async () => {
    const store = cartStore();
    const lookup = vi.fn(async () => ({ products: [product], legacyHit: false }));
    await mount(store, { lookup }, true, true);
    act(() => {
      for (const key of ['F4', 'F9', 'F10', 'F1', '1', '2', '3', '4', 'Enter']) fireEvent.keyDown(window, { key });
    });
    expect(store.getState().lines).toHaveLength(1);
    expect(store.getState().held).toHaveLength(0);
    expect(lookup).not.toHaveBeenCalled();
    expect(screen.queryByText('إتمام الدفع')).toBeNull();
  });

  it('holds the invoice on F4 when no dialog is open', async () => {
    const store = cartStore();
    await mount(store);
    act(() => {
      fireEvent.keyDown(window, { key: 'F4' });
    });
    expect(store.getState().lines).toHaveLength(0);
    expect(store.getState().held).toHaveLength(1);
  });

  it('ignores cart shortcuts while the payment dialog is open', async () => {
    const store = cartStore();
    await mount(store);
    await openPayment();

    act(() => {
      fireEvent.keyDown(window, { key: 'F4' });
      fireEvent.keyDown(window, { key: 'F10' });
      fireEvent.keyDown(window, { key: '3' });
    });

    expect(store.getState().lines).toHaveLength(1);
    expect(store.getState().held).toHaveLength(0);
    expect(store.getState().priceTier).toBe('retail1');
    expect(screen.getByText('إتمام الدفع')).toBeTruthy();
  });
});

describe('PosTerminal payment dialog', () => {
  beforeEach(() => localStorage.clear());

  it('removes payment before printing even if its closing animation never finishes', async () => {
    // Native printing can interrupt the exit animation, so animationend never reaches Radix Presence.
    const computedStyle = window.getComputedStyle.bind(window);
    const styles = vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const original = computedStyle(element, pseudo);
      return new Proxy(original, {
        get(target, key) {
          if (key === 'animationName' && element.getAttribute('role') === 'dialog') {
            return element.getAttribute('data-state') === 'open' ? 'enter' : 'exit';
          }
          return Reflect.get(target, key, target);
        },
      });
    });
    let releasePrint: (() => void) | undefined;
    const print = vi.fn(() => new Promise<void>((resolve) => { releasePrint = resolve; }));
    try {
      const store = cartStore();
      const createSale = vi.fn(async () => sale);
      await mount(store, { createSale, print });
      await openPayment();
      fireEvent.click(screen.getByRole('button', { name: /تأكيد البيع والطباعة/ }));
      await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
      expect(store.getState().lines).toHaveLength(0);
      expect(store.getState().lastSaleId).toBe(sale.id);
      expect(screen.queryByText('إتمام الدفع')).toBeNull();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(createSale).toHaveBeenCalledTimes(1);
      await act(async () => releasePrint?.());
      expect(screen.queryByText('إتمام الدفع')).toBeNull();
    } finally {
      await act(async () => releasePrint?.());
      styles.mockRestore();
    }
  });

  it('closes itself when the cart empties underneath it', async () => {
    const store = cartStore();
    await mount(store);
    await openPayment();

    act(() => store.getState().clear());

    await waitFor(() => expect(screen.queryByText('إتمام الدفع')).toBeNull());
  });

  it('creates one sale when confirm fires twice in the same tick', async () => {
    let release: (() => void) | undefined;
    const createSale = vi.fn(async () => {
      await new Promise<void>((r) => (release = r));
      return sale;
    });
    const store = cartStore();
    await mount(store, { createSale });
    await openPayment();

    const confirm = screen.getByRole('button', { name: /تأكيد البيع والطباعة/ });
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1));
    expect(createSale).toHaveBeenCalledTimes(1);

    await act(async () => {
      release?.();
    });
    await waitFor(() => expect(store.getState().lines).toHaveLength(0));
    await waitFor(() => expect(screen.queryByText('إتمام الدفع')).toBeNull());
  });
});

describe('PosTerminal products and invoice printing', () => {
  beforeEach(() => localStorage.clear());

  it('collapses products into the cart without changing the invoice and remembers the choice', async () => {
    const store = cartStore();
    await mount(store);
    fireEvent.click(screen.getByRole('button', { name: 'طيّ المنتجات' }));
    expect(document.querySelector('.pos-workspace')!.classList.contains('pos-products-collapsed')).toBe(true);
    expect(document.getElementById('pos-products-panel')!.getAttribute('aria-hidden')).toBe('true');
    expect(localStorage.getItem('pos.panelOpen.u1')).toBe('0');
    expect(store.getState().lines).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'العربة' }).textContent).toContain('P1');
    fireEvent.click(screen.getByRole('button', { name: 'إظهار المنتجات' }));
    expect(document.querySelector('.pos-workspace')!.classList.contains('pos-products-collapsed')).toBe(false);
  });

  it.each([
    ['فاتورة صغيرة', 'thermal80'],
    ['فاتورة كبيرة', 'a4'],
  ])('saves the sale before printing %s using %s', async (label, paper) => {
    const store = cartStore();
    const createSale = vi.fn(async () => sale);
    const print = vi.fn(async () => {
      expect(store.getState().lastSaleId).toBe(sale.id);
      expect(store.getState().lines).toHaveLength(0);
    });
    await mount(store, { createSale, print });
    expect(screen.queryByRole('button', { name: 'طباعة فاتورة صغيرة' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'طباعة فاتورة كبيرة' })).toBeNull();
    await openPayment();
    fireEvent.click(screen.getByRole('radio', { name: label }));
    expect((screen.getByRole('radio', { name: label }) as HTMLInputElement).checked).toBe(true);
    expect(print).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /تأكيد البيع والطباعة/ }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const [element, profile] = print.mock.calls[0] as unknown as [HTMLElement, { paper: string }];
    expect(profile.paper).toBe(paper);
    expect(element.textContent).toContain(sale.invoiceNumber);
    expect(element.querySelector('button')).toBeNull();
    expect(createSale).toHaveBeenCalledTimes(1);
    expect(store.getState().lines).toHaveLength(0);
  });

  it('reports a printer error and keeps the saved invoice available for retry', async () => {
    const store = cartStore();
    await mount(store, { createSale: async () => sale, print: async () => { throw new Error('Printer offline'); } });
    await openPayment();
    fireEvent.click(screen.getByRole('radio', { name: 'فاتورة كبيرة' }));
    fireEvent.click(screen.getByRole('button', { name: /تأكيد البيع والطباعة/ }));
    await waitFor(() => expect(screen.getByText('Printer offline')).toBeTruthy());
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(store.getState().lastSaleId).toBe(sale.id);
    expect(store.getState().lines).toHaveLength(0);
  });
});

describe('simple sale and printing flow', () => {
  it('uses the saved device profile and copies without offering a profile selector', async () => {
    const narrow = { ...defaultPrintProfiles().find((p) => p.paper === 'thermal58')!, copies: 2 };
    const saveProfile = vi.fn();
    const print = vi.fn(async () => undefined);
    await mount(cartStore(), { createSale: async () => sale, printProfiles: async () => defaultPrintProfiles().map((p) => p.id === narrow.id ? narrow : p), getDevicePrintProfile: () => narrow.id, setDevicePrintProfile: saveProfile, print });
    await openPayment();
    expect(screen.queryByLabelText('قالب الطباعة')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /تأكيد البيع والطباعة/ }));
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(saveProfile).not.toHaveBeenCalled();
    const [, profile] = print.mock.calls[0] as unknown as [HTMLElement, { paper: string; copies: number }];
    expect(profile.paper).toBe('thermal58');
    expect(profile.copies).toBe(2);
  });
  it.each([
    ['فاتورة صغيرة', 'thermal58', 'thermal58', 'width: 58mm'],
    ['فاتورة كبيرة', 'a5', 'a5', 'width: 148.492mm'],
  ] as const)('prints %s using the saved paper when the device returns %s', async (label, oldPaper, paper, width) => {
    const oldProfile = defaultPrintProfiles().find((p) => p.paper === oldPaper)!;
    const print = vi.fn(async () => undefined);
    await mount(cartStore(), { createSale: async () => sale, invoiceProfile: async () => oldProfile, print });
    await openPayment();
    fireEvent.click(screen.getByRole('radio', { name: label }));
    fireEvent.click(screen.getByRole('button', { name: /تأكيد البيع والطباعة/ }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    const [element, profile] = print.mock.calls[0] as unknown as [HTMLElement, { paper: string }];
    expect(profile.paper).toBe(paper);
    expect(element.querySelector('style')!.textContent).toContain(width);
    expect(oldProfile.paper).toBe(oldPaper);
  });

  it('blocks sale shortcuts while a print job is awaiting a decision', async () => {
    const store = cartStore();
    let release: (() => void) | undefined;
    const createSale = vi.fn(async () => sale);
    await mount(store, { createSale, print: () => new Promise<void>((resolve) => { release = resolve; }) });
    await openPayment();
    fireEvent.click(screen.getByRole('button', { name: /تأكيد البيع والطباعة/ }));
    await waitFor(() => expect(release).toBeDefined());
    act(() => store.getState().addLine({ productId: product.id, name: product.name, barcode: product.internalBarcode, sku: product.sku, listPrice: 100, unitPrice: 100, unitCost: 40, priceTier: 'retail1', discountPercent: 0, quantity: 1, available: 10 }));
    fireEvent.keyDown(window, { key: 'F4' });
    fireEvent.keyDown(window, { key: 'F9' });
    expect(store.getState().lines).toHaveLength(1);
    expect(screen.queryByText('إتمام الدفع')).toBeNull();
    expect(createSale).toHaveBeenCalledTimes(1);
    await act(async () => release?.());
  });

  it('keeps the existing web checkout behavior when desktop printing is disabled', async () => {
    const store = cartStore();
    const print = vi.fn(async () => undefined);
    await mount(store, { settings: async () => ({ ...DEFAULT_SETTINGS, pos: { ...DEFAULT_SETTINGS.pos, autoPrint: true } }), createSale: async () => sale, print }, false);
    await openPayment();
    expect(screen.queryByText('إتمام وطباعة')).toBeNull();
    const confirm = screen.getAllByText('إتمام البيع').find((el) => el.closest('[role="dialog"]'))!.closest('button')!;
    fireEvent.click(confirm);
    await waitFor(() => expect(store.getState().lastSaleId).toBe(sale.id));
    expect(print).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('قالب الطباعة')).toBeNull();
    expect(screen.queryByLabelText('إعادة طباعة')).toBeNull();
    expect(screen.getByText('INV-1')).toBeTruthy();
  });

  it('does not queue duplicate print jobs when pressed twice before the invoice loads', async () => {
    const store = cartStore();
    store.getState().setLastSale(sale.id);
    const print = vi.fn(async () => undefined);
    await mount(store, { lastSale: async () => sale, print });
    act(() => { fireEvent.keyDown(window, { key: 'F8' }); fireEvent.keyDown(window, { key: 'F8' }); });
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  });

  it('reports cancellation without reporting successful printing', async () => {
    const success = vi.spyOn(toast, 'success');
    const info = vi.spyOn(toast, 'info');
    const store = cartStore();
    const createSale = vi.fn(async () => sale);
    await mount(store, { createSale, print: async () => ({ status: 'cancelled' }) });
    await openPayment();
    fireEvent.click(screen.getByRole('button', { name: /تأكيد البيع والطباعة/ }));
    await waitFor(() => expect(info).toHaveBeenCalledWith('تم إلغاء الطباعة'));
    expect(success).not.toHaveBeenCalledWith('تم إرسال الفاتورة للطابعة');
    expect(store.getState().lastSaleId).toBe(sale.id);
    expect(store.getState().lines).toHaveLength(0);
    expect(createSale).toHaveBeenCalledTimes(1);
    info.mockRestore(); success.mockRestore();
  });

  it('retries a failed A4 print using the same invoice and size', async () => {
    const store = cartStore();
    const createSale = vi.fn(async () => sale);
    const print = vi.fn().mockRejectedValueOnce(new Error('Disconnected')).mockResolvedValue({ status: 'printed' });
    await mount(store, { createSale, print });
    await openPayment();
    fireEvent.click(screen.getByRole('radio', { name: 'فاتورة كبيرة' }));
    fireEvent.click(screen.getByRole('button', { name: /تأكيد البيع والطباعة/ }));
    await waitFor(() => expect(screen.getByText('Disconnected')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
    expect(print.mock.calls[1][1].paper).toBe('a4');
    expect(store.getState().lastSaleId).toBe(sale.id);
    expect(createSale).toHaveBeenCalledTimes(1);
    expect(print.mock.calls[0][0].textContent).toContain(sale.invoiceNumber);
    expect(print.mock.calls[1][0].textContent).toContain(sale.invoiceNumber);
  });

  it('does not print or clear the cart when saving the sale fails', async () => {
    const error = vi.spyOn(toast, 'error');
    const store = cartStore();
    const print = vi.fn(async () => undefined);
    await mount(store, { createSale: async () => { throw new Error('Cannot save'); }, print });
    await openPayment();
    fireEvent.click(screen.getByRole('button', { name: /تأكيد البيع والطباعة/ }));
    await waitFor(() => expect(error).toHaveBeenCalledWith('Cannot save'));
    expect(print).not.toHaveBeenCalled();
    expect(store.getState().lines).toHaveLength(1);
    expect(store.getState().lastSaleId).toBeNull();
    expect(screen.getByText('إتمام الدفع')).toBeTruthy();
    error.mockRestore();
  });

  it('uses the selected size when confirming by Enter', async () => {
    const store = cartStore();
    const print = vi.fn(async () => undefined);
    await mount(store, { createSale: async () => sale, print });
    await openPayment();
    fireEvent.click(screen.getByRole('radio', { name: 'فاتورة كبيرة' }));
    const amount = document.querySelector('[role="dialog"] input[type="number"]')!;
    fireEvent.keyDown(amount, { key: 'Enter' });
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect((print.mock.calls[0] as unknown as [HTMLElement, { paper: string }])[1].paper).toBe('a4');
  });
});
