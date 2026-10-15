import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DEFAULT_SETTINGS, PAPER_SIZES, defaultPrintProfiles, type PaperKind, type PrintProfile, type Sale } from '@moto/shared';
import { InvoiceDocument, pageStyleFor } from './templates';
import { profileForSize } from './profiles';

const sale: Sale = {
  id: 's1',
  invoiceNumber: 'INV-1001',
  date: '2026-02-03T11:30:00.000Z',
  branchId: 'br-1',
  cashierId: 'usr-1',
  customerId: null,
  registerSessionId: null,
  items: [
    { id: 'i1', productId: 'p1', name: { ar: 'بستم CG125' }, barcode: 'MP000011', sku: 'SKU-1', partNumber: 'HND-13011', quantity: 2, listPrice: 350, unitPrice: 350, unitCost: 220, priceTier: 'retail1', discount: 0, discountPercent: 0, subtotal: 700, returnedQty: 0 },
    { id: 'i2', productId: 'p2', name: { ar: 'تيل فرامل أمامي' }, barcode: 'MP000022', sku: 'SKU-2', partNumber: 'HND-06430', quantity: 1, listPrice: 85, unitPrice: 85, unitCost: 45, priceTier: 'wholesale', discount: 5, discountPercent: 0, subtotal: 80, returnedQty: 0 },
  ],
  subtotal: 785,
  itemDiscounts: 5,
  invoiceDiscount: 0,
  tax: 0,
  total: 780,
  paid: 800,
  remaining: 0,
  change: 20,
  payments: [{ method: 'cash', amount: 800 }],
  type: 'cash',
  status: 'completed',
};

const profileFor = (paper: PaperKind, extra: Partial<PrintProfile> = {}): PrintProfile => ({
  ...defaultPrintProfiles().find((x) => x.paper === paper)!,
  ...extra,
});

const papers: PaperKind[] = ['thermal58', 'thermal80', 'a5', 'a4'];

describe('invoice templates across every paper size', () => {
  it.each([
    ['small', 'thermal58', '.mpt', 'width: 58mm', '@page { size: 58mm 174mm; margin: 0; }'],
    ['large', 'a5', '.mpi', 'width: 148.492mm', '@page { size: 148mm 210mm; margin: 0; }'],
  ] as const)('renders the %s selection using the saved %s paper dimensions', (size, oldPaper, selector, width, page) => {
    const profile = profileForSize([profileFor(oldPaper)], size, null);
    const { container } = render(<InvoiceDocument sale={sale} profile={profile} settings={DEFAULT_SETTINGS} />);
    expect(container.querySelector(selector)).toBeTruthy();
    expect(container.querySelector('style')!.textContent).toContain(width);
    expect(pageStyleFor(profile)).toContain(page);
  });

  it.each(papers)('renders %s with the invoice number, items and total', (paper) => {
    const { container } = render(<InvoiceDocument sale={sale} profile={profileFor(paper)} settings={DEFAULT_SETTINGS} />);
    expect(container.textContent).toContain('INV-1001');
    expect(container.textContent).toContain('بستم CG125');
    expect(container.textContent).toContain('780');
  });

  it.each(papers)('%s declares RTL for Arabic', (paper) => {
    const { container } = render(<InvoiceDocument sale={sale} profile={profileFor(paper)} settings={DEFAULT_SETTINGS} />);
    expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
  });

  it.each(papers)('%s pins @page to the real paper dimensions', (paper) => {
    const css = pageStyleFor(profileFor(paper));
    const size = PAPER_SIZES[paper];
    expect(css).toContain(`${size.widthMm}mm`);
    expect(css).toContain(`${size.heightMm === 'auto' ? size.widthMm * 3 : size.heightMm}mm`);
  });

  it('sizes browser roll pages to the measured content height', () => {
    expect(pageStyleFor(profileFor('thermal80'), 420)).toContain('@page { size: 80mm 420mm; margin: 0; }');
    expect(pageStyleFor(profileFor('a4'), 420)).toContain('@page { size: 210mm 297mm; margin: 0; }');
  });

  it('detailed mode prints the part number, compact mode does not', () => {
    const detailed = render(<InvoiceDocument sale={sale} profile={profileFor('a5', { detail: 'detailed', showPartNumber: true })} settings={DEFAULT_SETTINGS} />);
    expect(detailed.container.textContent).toContain('HND-13011');
    detailed.unmount();

    const compact = render(<InvoiceDocument sale={sale} profile={profileFor('a5', { detail: 'compact', showPartNumber: true })} settings={DEFAULT_SETTINGS} />);
    expect(compact.container.textContent).not.toContain('HND-13011');
  });

  it.each(papers)('%s carries the branded invoice identity', (paper) => {
    const { container } = render(<InvoiceDocument sale={sale} profile={profileFor(paper)} settings={DEFAULT_SETTINGS} />);
    const root = container.querySelector('.mpi, .mpt')!;
    expect(root).toBeTruthy();
    // Shared chrome: the navy invoice banner, the table head and the grand-total bar.
    expect(container.querySelector('.mpi-banner, .mpt-banner')).toBeTruthy();
    expect(container.querySelector('.mpi-table, .mpt-table')).toBeTruthy();
    expect(container.querySelector('.mpi-grand, .mpt-grand')).toBeTruthy();
    expect(container.textContent).toContain('\u0641\u0627\u062a\u0648\u0631\u0629 \u0645\u0628\u064a\u0639\u0627\u062a');
  });

  it('renders A5 as the A4 sheet scaled by 1/\u221a2', () => {
    const a4 = render(<InvoiceDocument sale={sale} profile={profileFor('a4')} settings={DEFAULT_SETTINGS} />);
    expect(a4.container.querySelector('style')!.textContent).toContain('width: 210mm');
    a4.unmount();

    const a5 = render(<InvoiceDocument sale={sale} profile={profileFor('a5')} settings={DEFAULT_SETTINGS} />);
    const css = a5.container.querySelector('style')!.textContent!;
    expect(a5.container.querySelector('.mpi')).toBeTruthy();
    expect(css).toContain(`width: ${Math.round((210 / Math.SQRT2) * 1000) / 1000}mm`);
  });

  it.each(['thermal58', 'thermal80'] as const)('%s uses the narrow roll layout', (paper) => {
    const { container } = render(<InvoiceDocument sale={sale} profile={profileFor(paper)} settings={DEFAULT_SETTINGS} />);
    expect(container.querySelector('.mpt')).toBeTruthy();
    expect(container.querySelector('.mpi')).toBeNull();
    expect(container.querySelector('style')!.textContent).toContain(`width: ${PAPER_SIZES[paper].widthMm}mm`);
  });
});

describe('company and review stamps', () => {
  it('shows the company stamp on A5 when enabled and hides it when off', () => {
    const on = render(<InvoiceDocument sale={sale} profile={profileFor('a5', { showStamp: true })} settings={DEFAULT_SETTINGS} />);
    expect(screen.getByText('توقيع العميل')).toBeTruthy();
    expect(on.container.querySelector('.mpi-stamp')).toBeTruthy();
    on.unmount();

    const off = render(<InvoiceDocument sale={sale} profile={profileFor('a5', { showStamp: false, showReviewStamp: false })} settings={DEFAULT_SETTINGS} />);
    expect(off.container.querySelector('.mpi-stamp')).toBeNull();
    expect(off.container.querySelector('.mpi-reviewed')).toBeNull();
  });

  it('stamps the thermal receipt from the same profile flags', () => {
    const on = render(<InvoiceDocument sale={sale} profile={profileFor('thermal80', { showStamp: true, showReviewStamp: true })} settings={DEFAULT_SETTINGS} />);
    expect(on.container.querySelector('.mpt-stamp')).toBeTruthy();
    expect(on.container.querySelector('.mpt-reviewed')).toBeTruthy();
    on.unmount();

    const off = render(<InvoiceDocument sale={sale} profile={profileFor('thermal80', { showStamp: false, showReviewStamp: false })} settings={DEFAULT_SETTINGS} />);
    expect(off.container.querySelector('.mpt-stamp')).toBeNull();
    expect(off.container.querySelector('.mpt-reviewed')).toBeNull();
  });

  it('shows the review stamp only when the profile asks for it', () => {
    const off = render(<InvoiceDocument sale={sale} profile={profileFor('a5', { showReviewStamp: false })} settings={DEFAULT_SETTINGS} />);
    expect(off.container.textContent).not.toContain('تم المراجعة');
    off.unmount();

    render(<InvoiceDocument sale={sale} profile={profileFor('a5', { showReviewStamp: true })} settings={DEFAULT_SETTINGS} />);
    expect(screen.getByText('تم المراجعة')).toBeTruthy();
  });

  it('drives the branded A4 stamps from the profile', () => {
    const off = render(<InvoiceDocument sale={sale} profile={profileFor('a4', { showStamp: false, showReviewStamp: false })} settings={DEFAULT_SETTINGS} />);
    expect(off.container.querySelector('.mpi-stamp')).toBeNull();
    expect(off.container.querySelector('.mpi-reviewed')).toBeNull();
    off.unmount();

    const on = render(<InvoiceDocument sale={sale} profile={profileFor('a4', { showStamp: true, showReviewStamp: true })} settings={DEFAULT_SETTINGS} />);
    expect(on.container.querySelector('.mpi-stamp')).toBeTruthy();
    expect(on.container.querySelector('.mpi-reviewed')).toBeTruthy();
  });
});
