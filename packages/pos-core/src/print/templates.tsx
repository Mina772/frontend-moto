import * as React from 'react';
import type { AppSettings, Branch, Customer, MotorcycleModel, PrintProfile, Product, Sale, User } from '@moto/shared';
import { PAPER_SIZES } from '@moto/shared';
import { usePosT } from '../i18n';
import { invoiceFromSale, storeProfileFrom, type StoreProfile } from './invoiceModel';
import { SalesInvoiceA4 } from './SalesInvoiceA4';
import { SalesInvoiceThermal } from './SalesInvoiceThermal';

export interface PrintContext {
  sale: Sale;
  profile: PrintProfile;
  settings: AppSettings;
  branch?: Branch | null;
  cashier?: User | null;
  customer?: Customer | null;
  /** Product details for compatibility rows (detailed mode). */
  products?: Record<string, Product | undefined>;
  models?: Record<string, MotorcycleModel | undefined>;
  terminalCode?: string;
  verifyBaseUrl?: string;
  /** Overrides for the branded invoice header/footer (name, phones, warranty notes…). */
  store?: Partial<StoreProfile>;
}

/** A5 is A4 ÷ √2 on both axes, so one multiplier reproduces the A4 sheet exactly at A5. */
const A5_SCALE = 1 / Math.SQRT2;

function useBranded(ctx: PrintContext) {
  const { p, locale } = usePosT();
  return { invoice: invoiceFromSale(ctx, locale, p), store: storeProfileFrom(ctx, locale, p) };
}

/** Branded A4/A5 sales invoice built from a persisted sale. */
export const BrandedA4Invoice = React.forwardRef<HTMLDivElement, PrintContext>(function BrandedA4Invoice(ctx, ref) {
  const { invoice, store } = useBranded(ctx);
  return <SalesInvoiceA4 ref={ref} invoice={invoice} store={store} scale={ctx.profile.paper === 'a5' ? A5_SCALE : 1} />;
});

/** Same identity as the A4 invoice, laid out for a 58/80mm roll. */
export const BrandedThermalReceipt = React.forwardRef<HTMLDivElement, PrintContext>(function BrandedThermalReceipt(ctx, ref) {
  const { invoice, store } = useBranded(ctx);
  return (
    <SalesInvoiceThermal
      ref={ref}
      invoice={invoice}
      store={store}
      widthMm={ctx.profile.paper === 'thermal58' ? 58 : 80}
      compact={ctx.profile.detail === 'compact'}
    />
  );
});

/** Picks the right template for the profile. */
export const InvoiceDocument = React.forwardRef<HTMLDivElement, PrintContext>(function InvoiceDocument(ctx, ref) {
  const thermal = ctx.profile.paper === 'thermal58' || ctx.profile.paper === 'thermal80';
  return thermal ? <BrandedThermalReceipt ref={ref} {...ctx} /> : <BrandedA4Invoice ref={ref} {...ctx} />;
});

/** Roll pages require a numeric height: `80mm auto` is not a valid CSS page size. */
export function pageStyleFor(profile: PrintProfile, rollHeightMm?: number): string {
  const paper = PAPER_SIZES[profile.paper];
  const heightMm = paper.heightMm === 'auto' ? rollHeightMm ?? paper.widthMm * 3 : paper.heightMm;
  const size = `${paper.widthMm}mm ${heightMm}mm`;
  return `@page { size: ${size}; margin: 0; } @media print { html, body { margin: 0; padding: 0; background: #fff; } }`;
}
