import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AlternativeSuggestion, Customer, PaymentSplit, PriceTier, PrintProfile, Sale, SalePriceTier, SpecialPrice } from '@moto/shared';
import { allowedPriceTiers, clampPriceTier, uuid } from '@moto/shared';
import { Alert, Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Kbd, Sheet, SheetContent, SheetHeader, SheetTitle, SimpleTooltip, cn } from '@moto/ui';
import { Ban, Banknote, Barcode as BarcodeIcon, CreditCard, HandCoins, HelpCircle, LayoutGrid, MapPin, Maximize2, Minimize2, Monitor, PackageSearch, PanelBottomClose, PanelBottomOpen, PauseCircle, PlayCircle, Printer, SlidersHorizontal, Tag, Trash2, Undo2, User, UserX, Wallet, X } from 'lucide-react';
import type { PosAdapter, PosProduct } from '../adapter';
import { PosLocaleContext, formatDateTime, formatMoney, usePosT } from '../i18n';
import { cartTotals, createPosStore, lineDiscount, type CartLine, type PosStore } from '../store';
import { useScannerWedge } from '../hooks/useScannerWedge';
import { AlternativesDialog } from './AlternativesDialog';
import { CashDrawerDialog } from './CashDrawerDialog';
import { CollectDebtDialog } from './CollectDebtDialog';
import { ConnectivityBadge, useConnectivity } from './ConnectivityBadge';
import { CustomerPicker } from './CustomerPicker';
import { PaymentDialog } from './PaymentDialog';
import { ReturnDialog } from './ReturnDialog';
import { ProductFilterPanel } from './ProductFilterPanel';
import { QuickGrid } from './QuickGrid';
import { TierChooser, tierBadgeLabel } from './TierChooser';
import { InvoiceDocument, pageStyleFor } from '../print/templates';
import { availablePrintProfiles, invoiceProfileForSize, profileForSize, type InvoiceSize } from '../print/profiles';
import './PosTerminal.css';

export interface PosTerminalProps {
  adapter: PosAdapter;
  store?: PosStore;
  /** Base URL used in the QR fallback link. */
  verifyBaseUrl?: string;
  className?: string;
  /** Desktop checkout: choose an invoice size in the payment dialog and print after saving. */
  printOnComplete?: boolean;
  /** Host dialogs and the idle lock keep the cart mounted while suspending scanner/shortcuts. */
  suspended?: boolean;
}

/** Keeps a broken invoice template from unmounting the whole terminal — the sale is already saved. */
class RenderGuard extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('invoice template failed to render', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Remembers a UI preference on this device for this user; falls back to memory when storage is blocked. */
function usePersistedFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = React.useState(() => {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw === null || raw === undefined ? initial : raw === '1';
    } catch {
      return initial;
    }
  });
  const set = React.useCallback(
    (v: boolean) => {
      setValue(v);
      try {
        globalThis.localStorage?.setItem(key, v ? '1' : '0');
      } catch {
        /* private mode — keep the in-memory value */
      }
    },
    [key],
  );
  return [value, set];
}

function specialFor(list: SpecialPrice[], customerId: string | null, productId: string): number | null {
  if (!customerId) return null;
  const now = Date.now();
  const sp = list.find((s) => s.customerId === customerId && s.productId === productId && new Date(s.validFrom).getTime() <= now && (!s.validTo || new Date(s.validTo).getTime() >= now));
  return sp?.price ?? null;
}

export function PosTerminal({ adapter, store, verifyBaseUrl, className, printOnComplete, suspended }: PosTerminalProps) {
  return (
    <PosLocaleContext.Provider value={adapter.locale}>
      <PosTerminalInner adapter={adapter} store={store} verifyBaseUrl={verifyBaseUrl} className={className} printOnComplete={printOnComplete} suspended={suspended} />
    </PosLocaleContext.Provider>
  );
}

const defaultStore = createPosStore();

function PosTerminalInner({ adapter, store = defaultStore, verifyBaseUrl, className, printOnComplete, suspended }: PosTerminalProps) {
  const { p, tx, locale } = usePosT();
  const qc = useQueryClient();
  const pos = store();
  const has = (perm: string) => adapter.permissions.includes(perm as never);
  const canItemDiscount = has('discounts.item');
  const canInvoiceDiscount = has('discounts.invoice');
  const unlimitedDiscount = has('discounts.unlimited');
  const canWholesale = has('prices.wholesale');
  // Mirrors the server rule in sales/service.ts: either permission authorises an off-tier price.
  const canManualPrice = canWholesale || has('prices.edit');
  const canEditGrid = has('settings.edit') || has('settings.quick_grid');
  const canTransfer = has('inventory.transfer');
  const allowedTiers = React.useMemo(() => allowedPriceTiers(canWholesale), [canWholesale]);

  const connectivity = useConnectivity(adapter);
  const canDrawer = has('cash.open') || has('cash.close');
  const canCollect = has('customers.credit') || has('sales.create');

  const settingsQ = useQuery({ queryKey: ['pos', 'settings'], queryFn: () => adapter.settings(), staleTime: 60_000 });
  const settings = settingsQ.data;
  const defaultTier = settings?.pos.defaultPriceTier;
  const configureTiers = pos.configureTiers;
  React.useEffect(() => {
    if (defaultTier) configureTiers({ allowedTiers, defaultTier });
  }, [configureTiers, allowedTiers, defaultTier]);
  const totals = cartTotals(pos.lines, pos.invoiceDiscount, settings?.invoice);
  const customersQ = useQuery({ queryKey: ['pos', 'customers'], queryFn: () => adapter.customers(), staleTime: 60_000 });
  const specialQ = useQuery({ queryKey: ['pos', 'specialPrices'], queryFn: () => adapter.specialPrices(), staleTime: 60_000 });
  const quickQ = useQuery({ queryKey: ['pos', 'quick'], queryFn: () => adapter.quickGrid(), staleTime: 30_000 });
  const sessionQ = useQuery({ queryKey: ['pos', 'session'], queryFn: () => adapter.currentSession(), refetchInterval: 30_000 });
  const profilesQ = useQuery({ queryKey: ['pos', 'printProfiles'], queryFn: () => adapter.printProfiles(), staleTime: 300_000 });
  const profiles = React.useMemo(() => availablePrintProfiles(profilesQ.data ?? []), [profilesQ.data]);

  const [term, setTerm] = React.useState('');
  const [results, setResults] = React.useState<PosProduct[]>([]);
  const [legacyHit, setLegacyHit] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [payOpen, setPayOpen] = React.useState(false);
  const [custOpen, setCustOpen] = React.useState(false);
  const [heldOpen, setHeldOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [printError, setPrintError] = React.useState<{ message: string; size: InvoiceSize } | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [collectOpen, setCollectOpen] = React.useState(false);
  const [returnOpen, setReturnOpen] = React.useState(false);
  const [receiptSale, setReceiptSale] = React.useState<Sale | null>(null);
  React.useEffect(() => {
    if (!pos.lastSaleId || receiptSale?.id === pos.lastSaleId) return;
    let active = true;
    void adapter.lastSale(pos.lastSaleId).then((sale) => { if (active) setReceiptSale(sale); }).catch(() => undefined);
    return () => { active = false; };
  }, [adapter, pos.lastSaleId, receiptSale?.id]);
  const [selectedLine, setSelectedLine] = React.useState<string | null>(null);
  const [tierFor, setTierFor] = React.useState<string | null>(null);
  const [altFor, setAltFor] = React.useState<PosProduct | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const hiddenPrintRef = React.useRef<HTMLDivElement | null>(null);
  const [silentPrint, setSilentPrint] = React.useState<{ sale: Sale; profile: PrintProfile } | null>(null);
  const [printBusy, setPrintBusy] = React.useState(false);
  const printing = React.useRef(false);
  const lastPrintSize = React.useRef<InvoiceSize>('small');
  // Resolved by the hidden print root's ref callback, so printing never races the render.
  const printReady = React.useRef<(() => void) | null>(null);

  // A blocking overlay stops the scanner; the tier popover only claims the bare number keys.
  const dialogOpen = payOpen || custOpen || heldOpen || helpOpen || cancelOpen || printBusy || Boolean(printError) || drawerOpen || collectOpen || returnOpen || Boolean(altFor);
  const keyboardCaptured = dialogOpen || Boolean(tierFor);

  const [view, setView] = React.useState<'quick' | 'filter'>('quick');
  const [filterFocus, setFilterFocus] = React.useState(0);
  // Panel visibility and fullscreen are per user + device: a barcode-only cashier keeps the panel off.
  const [panelOpen, setPanelOpen] = usePersistedFlag(`pos.panelOpen.${adapter.user.id}`, true);
  const [fullscreen, setFullscreen] = React.useState(false);
  const openFilter = () => {
    setPanelOpen(true);
    setView('filter');
    setFilterFocus((n) => n + 1);
  };
  const metaQ = useQuery({ queryKey: ['pos', 'catalogMeta'], queryFn: () => adapter.catalogMeta!(), enabled: view === 'filter' && Boolean(adapter.catalogMeta), staleTime: 300_000 });

  const altQ = useQuery({ queryKey: ['pos', 'alternatives', altFor?.id], queryFn: () => adapter.alternatives(altFor!.id), enabled: Boolean(altFor) });

  // ---- search ----
  React.useEffect(() => {
    if (!term.trim()) {
      setResults([]);
      setLegacyHit(false);
      return;
    }
    const h = setTimeout(() => {
      adapter
        .lookup(term)
        .then((r) => {
          setResults(r.products);
          setLegacyHit(r.legacyHit);
          setActiveIdx(0);
        })
        .catch(() => setResults([]));
    }, 120);
    return () => clearTimeout(h);
  }, [term, adapter]);

  const resolvePrice = React.useCallback(
    (prod: PosProduct, tier: PriceTier): { price: number; tier: SalePriceTier } => {
      const sp = specialFor(specialQ.data ?? [], pos.customer?.id ?? null, prod.id);
      if (sp != null) return { price: sp, tier: 'special' };
      const t = clampPriceTier(tier, allowedTiers);
      return { price: prod.prices[t], tier: t };
    },
    [specialQ.data, pos.customer, allowedTiers],
  );

  const addProduct = React.useCallback(
    (prod: PosProduct, qty = 1, tierOverride?: PriceTier) => {
      if (!settings) return;
      const available = prod.available;
      const existing = pos.lines.find((l) => l.productId === prod.id);
      const nextQty = (existing?.quantity ?? 0) + qty;
      const allowNeg = settings.invoice.allowNegativeStock;
      if (available <= 0 && !allowNeg) {
        toast.error(p.outOfStock, { description: tx(prod.name) });
        setAltFor(prod);
        return;
      }
      if (nextQty > available && !allowNeg) {
        toast.warning(p.insufficientStock, { description: `${tx(prod.name)} — ${p.inStock}: ${available}` });
        return;
      }
      const { price, tier } = resolvePrice(prod, tierOverride ?? pos.priceTier);
      pos.addLine({ productId: prod.id, name: prod.name, barcode: prod.internalBarcode, sku: prod.sku, partNumber: prod.partNumber, listPrice: price, unitPrice: price, unitCost: prod.lastPurchaseCost || prod.purchasePrice, priceTier: tier, discountPercent: 0, available, quantity: qty });
      setSelectedLine(prod.id);
      setTerm('');
      setResults([]);
      if (settings.pos.showTierChooserOnScan && !existing && tier !== 'special') setTierFor(prod.id);
      searchRef.current?.focus();
    },
    [settings, pos, resolvePrice, p, tx],
  );

  useScannerWedge(
    (code) => {
      // A second scan beats an open tier popover, which would otherwise eat the barcode's digits.
      setTierFor(null);
      adapter.lookup(code).then((r) => {
        const prod = r.products[0];
        if (prod && r.products.length === 1) {
          if (r.legacyHit) toast.info(p.legacyBarcodeHint);
          addProduct(prod);
        } else {
          setTerm(code);
          searchRef.current?.focus();
        }
      });
    },
    { enabled: !dialogOpen && !suspended },
  );

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length === 0 && term.trim()) {
        toast.error(p.productNotFound, { description: term });
        return;
      }
      const prod = results[activeIdx];
      if (prod) addProduct(prod);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Escape') {
      setTerm('');
      setResults([]);
    }
  };

  // ---- complete ----
  const complete = useMutation({
    mutationFn: async (input: { payments: PaymentSplit[]; type: 'cash' | 'credit'; size: InvoiceSize }) => {
      const sale = await adapter.createSale({
        branchId: adapter.branchId,
        cashierId: adapter.user.id,
        customerId: pos.customer?.id ?? null,
        registerSessionId: sessionQ.data?.id ?? null,
        items: pos.lines.map((l) => ({ productId: l.productId, name: l.name, barcode: l.barcode, sku: l.sku, partNumber: l.partNumber, quantity: l.quantity, listPrice: l.listPrice, unitPrice: l.unitPrice, unitCost: l.unitCost, priceTier: l.priceTier, discountPercent: l.discountPercent, discount: lineDiscount(l) })),
        invoiceDiscount: pos.invoiceDiscount,
        payments: input.payments,
        type: input.type,
      });
      return sale;
    },
    onSuccess: async (sale, input) => {
      const offline = !adapter.connectivity().online;
      toast.success(p.saleCompleted, { description: `${sale.invoiceNumber} — ${formatMoney(sale.total, locale, settings?.currency.symbol)}${offline ? ` · ${p.savedOffline}` : ''}` });
      pos.clear();
      pos.setLastSale(sale.id);
      setPayOpen(false);
      setReceiptSale(sale);
      qc.invalidateQueries({ queryKey: ['pos', 'quick'] });
      qc.invalidateQueries({ queryKey: ['pos', 'customers'] });
      qc.invalidateQueries({ queryKey: ['pos', 'session'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      if (settings?.pos.openDrawerOnSale && sale.payments.some((x) => x.method === 'cash')) adapter.openDrawer?.().catch(() => toast.warning(p.drawerUnavailable));
      if (printOnComplete) {
        printing.current = true;
        setPrintBusy(true);
        setPrintError(null);
        lastPrintSize.current = input.size;
        try {
          await printSale(sale, input.size);
        } finally {
          printing.current = false;
          setPrintBusy(false);
        }
      }
      searchRef.current?.focus();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const printSale = React.useCallback(
    async (sale: Sale, size: InvoiceSize) => {
      try {
        const profile = adapter.invoiceProfile
          ? invoiceProfileForSize(await adapter.invoiceProfile(size), size)
          : profileForSize(profiles, size, adapter.getDevicePrintProfile());
        hiddenPrintRef.current = null;
        const mounted = new Promise<void>((resolve) => { printReady.current = resolve; });
        setSilentPrint({ sale, profile });
        // Bounded so a render that never lands cannot wedge the sale behind an unresolved promise.
        await Promise.race([mounted, new Promise((r) => setTimeout(r, 3000))]);
        await Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((resolve) => setTimeout(resolve, 3000))]);
        const el = hiddenPrintRef.current;
        if (!el) {
          // Printing anyway would send the whole POS screen to the thermal printer.
          throw new Error(p.printFailed);
        }
        const outcome = await adapter.print(el, profile);
        if (outcome?.status === 'cancelled') toast.info(p.printCancelled);
        else if (outcome?.status === 'saved') toast.success(p.pdfSaved);
        else toast.success(p.printSent);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setReceiptSale(sale);
        setPrintError({ message, size });
      } finally {
        printReady.current = null;
        setSilentPrint(null);
      }
    },
    [adapter, profiles, p],
  );

  const reprint = async (size: InvoiceSize = lastPrintSize.current) => {
    if (!pos.lastSaleId || printing.current || submitting.current) return;
    printing.current = true;
    lastPrintSize.current = size;
    setPrintBusy(true);
    setPrintError(null);
    try {
      const s = receiptSale?.id === pos.lastSaleId ? receiptSale : await adapter.lastSale(pos.lastSaleId);
      if (!s) { toast.error(p.noLastInvoice); return; }
      setReceiptSale(s);
      await printSale(s, size);
    } catch (error) {
      setPrintError({ message: error instanceof Error ? error.message : String(error), size });
    } finally {
      printing.current = false;
      setPrintBusy(false);
    }
  };

  // The cart can empty while the dialog is up (sale completed, invoice held) — it must not linger on a zero total.
  const cartSize = pos.lines.length;
  React.useEffect(() => {
    if (payOpen && !cartSize) setPayOpen(false);
  }, [payOpen, cartSize]);

  // Two confirms in one tick (double click, scanner's trailing Enter) must not bill twice;
  // `complete.isPending` only flips on the next render, so the guard has to be a ref.
  const submitting = React.useRef(false);

  const openPayment = () => {
    if (!pos.lines.length || !settings || submitting.current || printing.current) return;
    if (pos.saleType === 'credit' && !pos.customer) {
      toast.error(p.creditRequiresCustomer);
      setCustOpen(true);
      return;
    }
    setPayOpen(true);
  };

  // ---- shortcuts ----
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (suspended) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';
      // An open dialog owns the keyboard: F4/F10/Delete used to mutate the cart underneath it,
      // so a held invoice could empty the cart while the payment dialog still showed its total.
      if (keyboardCaptured && e.key !== 'F1') return;
      if (e.key === 'F1') { e.preventDefault(); setHelpOpen((o) => !o); }
      else if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
      else if (e.key === 'F3') { e.preventDefault(); setCustOpen(true); }
      else if (e.key === 'F5') { e.preventDefault(); openFilter(); }
      else if (e.key === 'F4') { e.preventDefault(); if (pos.lines.length) { pos.hold(); toast.info(p.invoiceHeld); } }
      else if (e.key === 'F6') { e.preventDefault(); setHeldOpen(true); }
      else if (e.key === 'F7') { e.preventDefault(); void adapter.openCustomerDisplay?.(); }
      else if (e.key === 'F8') { e.preventDefault(); void reprint(); }
      else if (e.key === 'F9') { e.preventDefault(); openPayment(); }
      else if (e.key === 'F10') { e.preventDefault(); if (pos.lines.length) setCancelOpen(true); }
      else if (e.altKey && (e.key === 'a' || e.key === 'A') && selectedLine) { e.preventDefault(); const l = pos.lines.find((x) => x.productId === selectedLine); if (l) adapter.product(l.productId).then((prod) => prod && setAltFor(prod)); }
      else if (e.key === 'Delete' && !inInput && selectedLine) { e.preventDefault(); pos.removeLine(selectedLine); setSelectedLine(null); }
      else if (e.key === '+' && !inInput && selectedLine) { e.preventDefault(); const l = pos.lines.find((x) => x.productId === selectedLine); if (l) pos.setQty(l.productId, l.quantity + 1); }
      else if (e.key === '-' && !inInput && selectedLine) { e.preventDefault(); const l = pos.lines.find((x) => x.productId === selectedLine); if (l) pos.setQty(l.productId, l.quantity - 1); }
      else if (e.key === 'F11') { e.preventDefault(); setPanelOpen(true); setView('quick'); setFullscreen((f) => !f); }
      else if (!inInput && allowedTiers[Number(e.key) - 1]) { e.preventDefault(); pos.setPriceTier(allowedTiers[Number(e.key) - 1]!); }
      else if (e.key === 'Escape' && !inInput) { setFullscreen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  React.useEffect(() => { searchRef.current?.focus(); }, []);

  const pickAlternative = (alt: AlternativeSuggestion, mode: 'replace' | 'add', tier: PriceTier) => {
    const prod: PosProduct = { ...alt.product, available: alt.qtyAvailable };
    const { price, tier: t } = resolvePrice(prod, tier);
    const line: Omit<CartLine, 'quantity'> = { productId: prod.id, name: prod.name, barcode: prod.internalBarcode, sku: prod.sku, partNumber: prod.partNumber, listPrice: price, unitPrice: price, unitCost: prod.lastPurchaseCost || prod.purchasePrice, priceTier: t, discountPercent: 0, available: prod.available };
    if (mode === 'replace' && altFor && pos.lines.some((l) => l.productId === altFor.id)) pos.replaceLine(altFor.id, line);
    else pos.addLine({ ...line, quantity: 1 });
    setSelectedLine(prod.id);
    setAltFor(null);
    searchRef.current?.focus();
  };

  if (!settings) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">…</div>;
  const sym = settings.currency.symbol;
  const m = (v: number, d?: number) => formatMoney(v, locale, sym, d ?? settings.currency.decimals);
  const allowNeg = settings.invoice.allowNegativeStock;
  const registerClosed = !sessionQ.isLoading && !sessionQ.data;

  const cashierLine = (l: CartLine) => {
    const lineNet = l.unitPrice * l.quantity * (1 - l.discountPercent / 100);
    const selected = selectedLine === l.productId;
    const prod = quickQ.data?.catalog.find((c) => c.id === l.productId);
    const prodPrices = prod?.prices;
    return (
      <tr key={l.productId} onClick={() => setSelectedLine(l.productId)} className={cn('cursor-pointer border-b text-sm transition-colors last:border-0', selected ? 'bg-primary/10' : 'hover:bg-muted/50')}>
        <td className="px-2 py-1.5">
          <div className="font-medium leading-tight">{tx(l.name)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-xs text-muted-foreground">
            <span>{p.barcode}: <bdi className="num">{l.barcode}</bdi></span>
            <span>{p.sku}: <bdi className="num">{l.sku}</bdi></span>
            {l.partNumber ? <span>{p.receipt.partNumber}: <bdi className="num">{l.partNumber}</bdi></span> : null}
            {prod?.size ? <span>{p.productSize}: <bdi className="num">{prod.size}</bdi></span> : null}
            <span>{p.inStock}: <bdi className="num">{prod?.available ?? l.available}</bdi></span>
            {prod?.location ? <span className="inline-flex items-center gap-0.5 font-medium text-primary"><MapPin className="size-2.5" /> {prod.location}</span> : null}
            <TierChooser
              open={tierFor === l.productId}
              onOpenChange={(o) => setTierFor(o ? l.productId : null)}
              prices={prodPrices ?? { retail1: l.listPrice, retail2: l.listPrice, wholesale: l.listPrice }}
              current={l.priceTier}
              specialPrice={specialFor(specialQ.data ?? [], pos.customer?.id ?? null, l.productId)}
              settings={settings}
              allowedTiers={allowedTiers}
              onPick={(tier, price) => pos.setLineTier(l.productId, tier, price)}
            >
              <button type="button" onClick={(e) => { e.stopPropagation(); setTierFor(l.productId); }} className="inline-flex">
                <Badge variant={l.priceTier === 'wholesale' ? 'warning' : l.priceTier === 'special' ? 'info' : l.priceTier === 'manual' ? 'secondary' : 'outline'} className="h-4 cursor-pointer gap-0.5 px-1 text-[9px]">
                  <Tag className="size-2.5" /> {tierBadgeLabel(settings, l.priceTier, p, locale)}
                </Badge>
              </button>
            </TierChooser>
            <SimpleTooltip content={`${p.alternatives} (Alt+A)`}>
              <button type="button" onClick={(e) => { e.stopPropagation(); adapter.product(l.productId).then((prod) => prod && setAltFor(prod)); }} className="rounded p-0.5 hover:bg-accent" aria-label={p.alternatives}>
                <PackageSearch className="size-3" />
              </button>
            </SimpleTooltip>
          </div>
        </td>
        <td className="px-2 py-1.5 text-end">
          {canManualPrice ? <input type="number" value={l.unitPrice} onChange={(e) => pos.setLinePrice(l.productId, Number(e.target.value))} className="w-20 rounded border bg-transparent px-1 py-0.5 text-end text-sm tabular focus:outline-none focus:ring-1 focus:ring-ring" dir="ltr" /> : <span className="num">{m(l.unitPrice)}</span>}
        </td>
        <td className="px-2 py-1.5 text-center">
          <div className="inline-flex items-center rounded-md border" dir="ltr">
            <button type="button" className="px-2 py-0.5 hover:bg-accent" onClick={(e) => { e.stopPropagation(); pos.setQty(l.productId, l.quantity - 1); }}>−</button>
            <input type="number" value={l.quantity} min={0} max={allowNeg ? undefined : l.available} onChange={(e) => pos.setQty(l.productId, Number(e.target.value))} className="w-10 border-x bg-transparent py-0.5 text-center text-sm tabular focus:outline-none" onClick={(e) => e.stopPropagation()} />
            <button type="button" className="px-2 py-0.5 hover:bg-accent disabled:opacity-40" disabled={!allowNeg && l.quantity >= l.available} onClick={(e) => { e.stopPropagation(); pos.setQty(l.productId, l.quantity + 1); }}>+</button>
          </div>
        </td>
        <td className="px-2 py-1.5 text-center">
          {canItemDiscount ? (
            <div className="inline-flex items-center gap-0.5" dir="ltr">
              <input type="number" min={0} max={unlimitedDiscount ? 100 : settings.pos.maxDiscountPercent} value={l.discountPercent} onChange={(e) => { const v = Number(e.target.value); if (!unlimitedDiscount && v > settings.pos.maxDiscountPercent) { toast.warning(p.discountExceeds, { description: `${p.max} ${settings.pos.maxDiscountPercent}%` }); return; } pos.setLineDiscount(l.productId, v); }} className="w-12 rounded border bg-transparent px-1 py-0.5 text-center text-sm tabular focus:outline-none focus:ring-1 focus:ring-ring" onClick={(e) => e.stopPropagation()} />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-2 py-1.5 text-end font-medium num">{m(lineNet)}</td>
        <td className="px-1 py-1.5"><Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); pos.removeLine(l.productId); }} aria-label={p.delete}><X /></Button></td>
      </tr>
    );
  };

  const printCtx = (sale: Sale) => ({
    sale,
    settings,
    cashier: adapter.user,
    customer: (customersQ.data ?? []).find((c) => c.id === sale.customerId) ?? null,
    products: Object.fromEntries((quickQ.data?.catalog ?? []).map((c) => [c.id, c])),
    terminalCode: adapter.terminalCode,
    verifyBaseUrl,
  });

  const quickGrid = (full: boolean) => (
    <QuickGrid
      quick={quickQ.data?.products ?? []}
      categories={quickQ.data?.categories ?? []}
      catalog={quickQ.data?.catalog ?? []}
      settings={settings}
      tier={pos.priceTier}
      canEdit={canEditGrid}
      allowNegative={allowNeg}
      fullscreen={full}
      onToggleFullscreen={() => setFullscreen(!full)}
      onPick={(prod) => addProduct(prod)}
      onSave={async (i) => { await adapter.saveQuickProduct(i); qc.invalidateQueries({ queryKey: ['pos', 'quick'] }); }}
      onDelete={async (id) => { await adapter.deleteQuickProduct(id); qc.invalidateQueries({ queryKey: ['pos', 'quick'] }); }}
      onReorder={async (ids) => { await adapter.reorderQuick(ids); qc.invalidateQueries({ queryKey: ['pos', 'quick'] }); }}
      lookup={async (t) => (await adapter.lookup(t)).products}
    />
  );

  return (
    <div className={cn('flex h-full min-w-0 flex-col overflow-hidden', className)}>
      {/* Fullscreen quick products: the cart stays mounted behind it, so Esc returns to an untouched sale. */}
      {fullscreen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b p-2">
            <span className="font-medium">{p.quickProducts}</span>
            <Badge variant="outline" className="num">{pos.lines.length} · {m(totals.total)}</Badge>
            <Button size="sm" variant="outline" className="ms-auto" onClick={() => setFullscreen(false)}><Minimize2 /> {p.exitFullscreen} <Kbd>Esc</Kbd></Button>
          </div>
          {quickGrid(true)}
        </div>
      ) : null}
      {/* Left */}
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="flex items-center gap-2 border-b p-2">
          <div className="relative flex-1">
            <Input ref={searchRef} value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={onSearchKey} placeholder={p.scanPlaceholder} className="h-11 text-base ps-10" startIcon={<BarcodeIcon className="!size-5" />} autoComplete="off" aria-label={p.search} />
            {results.length > 0 ? (
              <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover shadow-lg">
                {legacyHit ? <div className="bg-warning/10 px-3 py-1 text-[11px] text-amber-700">{p.legacyBarcodeHint}</div> : null}
                {results.map((prod, i) => (
                  <button key={prod.id} type="button" onMouseEnter={() => setActiveIdx(i)} onClick={() => addProduct(prod)} className={cn('flex w-full items-center gap-3 border-b px-3 py-2 text-start last:border-0', i === activeIdx && 'bg-accent')}>
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-medium">{tx(prod.name)}</div>
                      <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        <span>{p.barcode}: <bdi className="num">{prod.internalBarcode}</bdi></span>
                        <span>{p.sku}: <bdi className="num">{prod.sku}</bdi></span>
                        <span>{p.receipt.partNumber}: <bdi className="num">{prod.partNumber}</bdi></span>
                        {prod.size ? <span>{p.productSize}: <bdi className="num">{prod.size}</bdi></span> : null}
                      </div>
                      {prod.location ? (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-primary"><MapPin className="size-3" /> {prod.location}</div>
                      ) : null}
                    </div>
                    <Badge variant={prod.available === 0 ? 'destructive' : prod.available < prod.minStock ? 'warning' : 'success'}>{p.stock}: {prod.available}</Badge>
                    {prod.available === 0 ? <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setAltFor(prod); }}><PackageSearch /> {p.alternatives}</Button> : null}
                    <span className="w-24 text-end text-sm font-semibold num">{m(prod.prices[pos.priceTier], 0)}</span>
                  </button>
                ))}
                <div className="flex gap-3 border-t px-3 py-1 text-[10px] text-muted-foreground"><span><Kbd>↑↓</Kbd> {p.navigate}</span><span><Kbd>↵</Kbd> {p.enterToAdd}</span><span><Kbd>Esc</Kbd> {p.escClose}</span></div>
              </div>
            ) : null}
          </div>
          {adapter.cashMovement && canDrawer ? <SimpleTooltip content={p.drawer.title}><Button variant="outline" size="icon" onClick={() => setDrawerOpen(true)} aria-label={p.drawer.title}><Banknote /></Button></SimpleTooltip> : null}
          {adapter.collectDebt && canCollect ? <SimpleTooltip content={p.collect.title}><Button variant="outline" size="icon" onClick={() => setCollectOpen(true)} aria-label={p.collect.title}><HandCoins /></Button></SimpleTooltip> : null}
          <SimpleTooltip content={`${p.shortcuts} (F1)`}><Button variant="outline" size="icon" onClick={() => setHelpOpen(true)} aria-label={p.shortcuts}><HelpCircle /></Button></SimpleTooltip>
          {adapter.openCustomerDisplay ? <SimpleTooltip content={`${p.customerDisplay} (F7)`}><Button variant="outline" size="icon" onClick={() => void adapter.openCustomerDisplay?.()} aria-label={p.customerDisplay}><Monitor /></Button></SimpleTooltip> : null}
        </div>

        {registerClosed ? (
          <div className="p-3">
            <Alert variant="warning" title={p.registerClosed}>
              <div className="flex flex-wrap items-center gap-2">
                <span>{p.registerClosedDesc}</span>
                <Button size="xs" variant="outline" onClick={() => adapter.navigate('/cash-registers')}>{p.openRegister}</Button>
              </div>
            </Alert>
          </div>
        ) : null}
        {connectivity.unregistered ? <div className="px-3 pt-2"><Alert variant="destructive" title={p.unregistered}>{p.unregisteredDesc}</Alert></div> : !connectivity.online ? <div className="px-3 pt-2"><Alert variant="warning">{adapter.offlineNotice ?? p.offlineNotice}</Alert></div> : null}

        <div className="flex items-center justify-between px-3 pt-2 text-xs font-medium text-muted-foreground">
          <div className="flex items-center rounded-md border p-0.5" role="tablist">
            <button type="button" role="tab" aria-selected={panelOpen && view === 'quick'} onClick={() => { setPanelOpen(true); setView('quick'); }} className={cn('flex items-center gap-1 rounded px-2 py-1', panelOpen && view === 'quick' ? 'bg-secondary text-foreground' : 'hover:bg-accent')}>
              <LayoutGrid className="size-3.5" /> {p.quickProducts}
            </button>
            <button type="button" role="tab" aria-selected={panelOpen && view === 'filter'} onClick={openFilter} className={cn('flex items-center gap-1 rounded px-2 py-1', panelOpen && view === 'filter' ? 'bg-secondary text-foreground' : 'hover:bg-accent')}>
              <SlidersHorizontal className="size-3.5" /> {p.filter.tab} <Kbd>F5</Kbd>
            </button>
          </div>
          <span className="flex items-center gap-1">
            {panelOpen && view === 'quick' ? (
              <SimpleTooltip content={`${p.fullscreen} (F11)`}>
                <Button size="icon-xs" variant="ghost" onClick={() => setFullscreen(true)} aria-label={p.fullscreen}><Maximize2 /></Button>
              </SimpleTooltip>
            ) : null}
            <SimpleTooltip content={panelOpen ? p.hidePanel : p.showPanel}>
              <Button size="xs" variant="outline" onClick={() => setPanelOpen(!panelOpen)} aria-label={panelOpen ? p.hidePanel : p.showPanel} aria-expanded={panelOpen} aria-controls="pos-products-panel">
                {panelOpen ? <PanelBottomClose /> : <PanelBottomOpen />} {panelOpen ? p.hidePanel : p.showPanel}
              </Button>
            </SimpleTooltip>
            <ConnectivityBadge adapter={adapter} compact />
          </span>
        </div>
        <div className={cn('pos-workspace min-h-0 flex-1', !panelOpen && 'pos-products-collapsed')}>
        <div id="pos-products-panel" className="pos-catalog" aria-hidden={!panelOpen}>
        {view === 'filter' ? (
          <ProductFilterPanel
            catalog={quickQ.data?.catalog ?? []}
            meta={metaQ.data}
            settings={settings}
            tier={pos.priceTier}
            allowNegative={allowNeg}
            onPick={(prod) => addProduct(prod)}
            focusKey={filterFocus}
          />
        ) : (
          quickGrid(false)
        )}
      </div>

      {/* Right: cart */}
      <div className="pos-cart flex min-h-0 min-w-0 flex-col bg-card" role="region" aria-label={p.cart}>
        <div className="flex items-center gap-2 border-b p-2">
          <Button variant={pos.customer ? 'secondary' : 'outline'} size="sm" className="h-9 flex-1 justify-start gap-2 overflow-hidden" onClick={() => setCustOpen(true)}>
            {pos.customer ? <User className="shrink-0" /> : <UserX className="shrink-0 text-muted-foreground" />}
            <span className="truncate">{pos.customer ? tx(pos.customer.name) : p.walkIn}</span>
            {pos.customer ? <Badge variant="outline" className="ms-auto shrink-0">{p.types[pos.customer.type]}</Badge> : <Kbd className="ms-auto">F3</Kbd>}
          </Button>
          {pos.customer ? <Button variant="ghost" size="icon-sm" onClick={() => pos.setCustomer(null)} aria-label={p.clear}><X /></Button> : null}
          <div className="inline-flex rounded-md border p-0.5">
            <Button size="xs" variant={pos.saleType === 'cash' ? 'default' : 'ghost'} onClick={() => pos.setSaleType('cash')}>{p.cashSale}</Button>
            <Button size="xs" variant={pos.saleType === 'credit' ? 'warning' : 'ghost'} onClick={() => pos.setSaleType('credit')}>{p.creditSale}</Button>
          </div>
        </div>
        <div className="flex items-center gap-2 border-b px-2 py-1 text-xs">
          <span className="text-muted-foreground">{p.priceType}:</span>
          <div className="inline-flex rounded-md border p-0.5">
            {allowedTiers.map((t, i) => (
              <Button key={t} size="xs" className="h-6" variant={pos.priceTier === t ? 'secondary' : 'ghost'} onClick={() => pos.setPriceTier(t)}>
                <span className="me-1 text-[9px] opacity-60">{i + 1}</span>{tx(settings.pricing.tierLabels[t])}
              </Button>
            ))}
          </div>
          {pos.customer && pos.customer.creditLimit > 0 ? <span className="ms-auto num text-muted-foreground">{p.availableCredit}: <span className={cn('font-medium', pos.customer.creditLimit - pos.customer.balance < totals.total && pos.saleType === 'credit' ? 'text-destructive' : 'text-foreground')}>{m(Math.max(0, pos.customer.creditLimit - pos.customer.balance))}</span></span> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {pos.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <BarcodeIcon className="size-10 opacity-30" />
              <div className="text-sm font-medium">{p.emptyCart}</div>
              <div className="text-xs">{p.emptyCartHint}</div>
              <div className="mt-2 flex items-center gap-1 text-xs"><Kbd>F2</Kbd> {p.focusSearch}</div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/80 text-[11px] text-muted-foreground backdrop-blur">
                <tr><th className="px-2 py-1.5 text-start font-medium">{p.product}</th><th className="px-2 py-1.5 text-end font-medium">{p.price}</th><th className="px-2 py-1.5 text-center font-medium">{p.quantity}</th><th className="px-2 py-1.5 text-center font-medium">{p.discount}</th><th className="px-2 py-1.5 text-end font-medium">{p.subtotal}</th><th /></tr>
              </thead>
              <tbody>{pos.lines.map(cashierLine)}</tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 border-t bg-muted/30 p-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>{p.subtotal} <span className="text-xs">({totals.qty} {p.items})</span></span><span className="num">{m(totals.subtotal)}</span></div>
            {totals.itemDiscounts > 0 ? <div className="flex justify-between text-muted-foreground"><span>{p.itemDiscount}</span><span className="num">-{m(totals.itemDiscounts)}</span></div> : null}
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{p.invoiceDiscount}</span>
              {canInvoiceDiscount ? (
                <input type="number" min={0} value={pos.invoiceDiscount || ''} placeholder="0" onChange={(e) => { const v = Number(e.target.value) || 0; const maxAllowed = unlimitedDiscount ? totals.subtotal : (totals.subtotal * settings.pos.maxDiscountPercent) / 100; if (v > maxAllowed) { toast.warning(p.discountExceeds); return; } pos.setInvoiceDiscount(v); }} className="w-24 rounded border bg-background px-2 py-0.5 text-end text-sm tabular focus:outline-none focus:ring-1 focus:ring-ring" dir="ltr" />
              ) : <span className="num">-{m(pos.invoiceDiscount)}</span>}
            </div>
            {totals.tax > 0 ? <div className="flex justify-between text-muted-foreground"><span>{p.receipt.tax} ({settings.invoice.taxRate}%)</span><span className="num">{m(totals.tax)}</span></div> : null}
            <div className="flex items-baseline justify-between border-t pt-2"><span className="text-base font-semibold">{p.netTotal}</span><span className="text-2xl font-bold tabular num">{m(totals.total)}</span></div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <Button variant="outline" size="sm" onClick={() => { pos.hold(); toast.info(p.invoiceHeld); }} disabled={!pos.lines.length} className="h-12 flex-col gap-0 text-[11px]"><PauseCircle /> {p.holdInvoice} <Kbd className="h-4 text-[9px]">F4</Kbd></Button>
            <Button variant="outline" size="sm" onClick={() => setHeldOpen(true)} className="relative h-12 flex-col gap-0 text-[11px]"><PlayCircle /> {p.resumeInvoice} <Kbd className="h-4 text-[9px]">F6</Kbd>{pos.held.length ? <span className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full bg-warning text-[10px] text-white">{pos.held.length}</span> : null}</Button>
            <Button variant="outline" size="sm" onClick={() => (adapter.createSaleReturn ? setReturnOpen(true) : adapter.navigate('/sales/returns'))} className="h-12 flex-col gap-0 text-[11px]" disabled={!has('returns.create')}><Undo2 /> {p.returnSale}</Button>
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)} disabled={!pos.lines.length} className="h-12 flex-col gap-0 text-[11px] text-destructive hover:text-destructive"><Ban /> {p.cancelInvoice} <Kbd className="h-4 text-[9px]">F10</Kbd></Button>
          </div>
          <div className="mt-2">
            <Button size="lg" className="h-12 w-full text-base" onClick={openPayment} disabled={!pos.lines.length || registerClosed || complete.isPending || printBusy}>
              {pos.saleType === 'credit' ? <Wallet /> : <CreditCard />} {p.completeSale} <Kbd className="ms-2 bg-white/20 text-white">F9</Kbd>
            </Button>
          </div>
          <div className="mt-3 border-t pt-2" aria-live="polite">
            <div className="mb-2 text-xs text-muted-foreground">{printBusy ? p.printSending : receiptSale ? <>{p.printLastInvoice}: <bdi className="num font-semibold text-foreground">{receiptSale.invoiceNumber}</bdi></> : p.noLastInvoice}</div>
          {!printOnComplete ? <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" disabled={!pos.lastSaleId || printBusy} onClick={() => void reprint('small')}><Printer /> {p.printSmall}</Button>
            <Button variant="outline" disabled={!pos.lastSaleId || printBusy} onClick={() => void reprint('large')}><Printer /> {p.printLarge}</Button>
          </div> : null}
          </div>
        </div>
      </div>
      </div>
      </div>

      {/* Dialogs */}
      {/* Native printing can interrupt animationend. Unmount payment immediately so its portal cannot trap the empty cart. */}
      {payOpen && cartSize > 0 ? <PaymentDialog open onOpenChange={setPayOpen} total={totals.total} saleType={pos.saleType} customer={pos.customer} settings={settings} loading={complete.isPending} printOnConfirm={printOnComplete} onConfirm={(payments, size) => { if (submitting.current || printing.current) return; submitting.current = true; complete.mutate({ payments, type: pos.saleType, size }, { onSettled: () => { submitting.current = false; } }); }} /> : null}
      <CustomerPicker open={custOpen} onOpenChange={setCustOpen} customers={customersQ.data ?? []} currencySymbol={sym} onSelect={(c: Customer | null) => { pos.setCustomer(c); setCustOpen(false); searchRef.current?.focus(); }} onCreate={async (i) => { const c = await adapter.createCustomer(i); qc.invalidateQueries({ queryKey: ['pos', 'customers'] }); return c; }} />
      <AlternativesDialog
        open={Boolean(altFor)}
        onOpenChange={(o) => !o && setAltFor(null)}
        requested={altFor}
        requestedAvailable={altFor?.available ?? 0}
        suggestions={altQ.data}
        loading={altQ.isLoading}
        settings={settings}
        tier={pos.priceTier}
        allowedTiers={allowedTiers}
        canTransfer={canTransfer}
        inCart={Boolean(altFor && pos.lines.some((l) => l.productId === altFor.id))}
        branchName={adapter.branchName}
        onPick={pickAlternative}
        onRequestTransfer={adapter.requestTransfer ? (alt, branchId) => { void adapter.requestTransfer?.(alt.product.id, branchId, 1).then(() => toast.success(p.transferRequested)).catch((e: Error) => toast.error(e.message)); setAltFor(null); } : undefined}
      />
      {adapter.cashMovement ? (
        <CashDrawerDialog
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          session={sessionQ.data ?? null}
          settings={settings}
          onPost={async (i) => { await adapter.cashMovement!(i); toast.success(p.drawer.posted); await qc.invalidateQueries({ queryKey: ['pos', 'session'] }); }}
        />
      ) : null}
      {adapter.collectDebt ? (
        <CollectDebtDialog
          open={collectOpen}
          onOpenChange={setCollectOpen}
          customers={customersQ.data ?? []}
          preselected={pos.customer}
          settings={settings}
          onCollect={async (i) => { await adapter.collectDebt!(i); toast.success(p.collect.done); await Promise.all([qc.invalidateQueries({ queryKey: ['pos', 'customers'] }), qc.invalidateQueries({ queryKey: ['pos', 'session'] })]); }}
        />
      ) : null}
      {adapter.createSaleReturn ? (
        <ReturnDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          settings={settings}
          findInvoice={(inv) => adapter.saleByInvoice?.(inv) ?? Promise.resolve(null)}
          recentSales={() => adapter.recentSales?.(30) ?? Promise.resolve([])}
          onSubmit={(i) => adapter.createSaleReturn!(i)}
          onDone={(ret) => {
            toast.success(p.returns.done, { description: `${ret.invoiceNumber} — ${m(ret.refundAmount)}` });
            qc.invalidateQueries({ queryKey: ['pos', 'session'] });
            qc.invalidateQueries({ queryKey: ['pos', 'customers'] });
            qc.invalidateQueries({ queryKey: ['pos', 'quick'] });
          }}
        />
      ) : null}
      <Dialog open={Boolean(printError)} onOpenChange={(open) => !open && setPrintError(null)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>{p.printFailed}</DialogTitle><DialogDescription>{printError?.message}</DialogDescription></DialogHeader>
          <p className="text-sm text-muted-foreground">{p.invoiceStillSaved} <bdi className="num">{receiptSale?.invoiceNumber}</bdi></p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintError(null)}>{p.close}</Button>
            <Button onClick={() => { const size = printError!.size; void reprint(size); }}>{p.retryPrint}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>{p.confirmCancel}</DialogTitle><DialogDescription>{p.confirmCancelDesc}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>{p.cancel}</Button>
            <Button variant="destructive" onClick={() => { pos.clear(); setCancelOpen(false); toast.info(p.invoiceCancelled); }}>{p.cancelInvoice}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={heldOpen} onOpenChange={setHeldOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{p.heldInvoices}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2">
            {pos.held.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">{p.noHeld}</div> : pos.held.map((h) => {
              const ht = cartTotals(h.lines, h.invoiceDiscount, settings?.invoice);
              return (
                <div key={h.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between text-sm"><span className="font-medium num">{h.id}</span><span className="font-semibold num">{m(ht.total)}</span></div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(h.heldAt)} · {h.lines.length} {p.items} · {h.customer ? tx(h.customer.name) : p.walkIn}</div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => { pos.resume(h.id); setHeldOpen(false); }}><PlayCircle /> {p.resumeInvoice}</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => pos.dropHeld(h.id)}><Trash2 /> {p.delete}</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{p.shortcuts}</SheetTitle></SheetHeader>
          <div className="mt-4 grid gap-1.5 text-sm">
            {Object.entries(p.shortcutsList).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded border px-2 py-1"><span>{v}</span><Kbd>{k === 'plusMinus' ? '+ / −' : k === 'digits' ? '1 2 3' : k === 'A' ? 'Alt+A' : k}</Kbd></div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Off-screen print area: visible only when printing (web) or captured by the host (desktop). */}
      {silentPrint ? (
        <div className="print-area pos-print-root fixed -left-[10000px] top-0 print:static print:left-0" aria-hidden>
          <style>{pageStyleFor(silentPrint.profile)}</style>
          <RenderGuard>
            <InvoiceDocument
              ref={(el: HTMLDivElement | null) => {
                hiddenPrintRef.current = el;
                if (el) printReady.current?.();
              }}
              {...printCtx(silentPrint.sale)}
              profile={silentPrint.profile}
            />
          </RenderGuard>
        </div>
      ) : null}
    </div>
  );
}

export { uuid };
