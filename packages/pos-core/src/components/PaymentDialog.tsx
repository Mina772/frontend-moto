import * as React from 'react';
import type { AppSettings, Customer, PaymentMethod, PaymentSplit, SaleType } from '@moto/shared';
import { round2 } from '@moto/shared';
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Kbd, cn } from '@moto/ui';
import { Banknote, CreditCard, FileText, Landmark, ReceiptText } from 'lucide-react';
import { formatMoney, usePosT } from '../i18n';
import type { InvoiceSize } from '../print/profiles';

export interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  total: number;
  saleType: SaleType;
  customer: Customer | null;
  settings: AppSettings;
  loading?: boolean;
  printOnConfirm?: boolean;
  onConfirm: (payments: PaymentSplit[], size: InvoiceSize) => void;
}

const METHODS: { key: Exclude<PaymentMethod, 'credit'>; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'cash', icon: Banknote },
  { key: 'card', icon: CreditCard },
  { key: 'bank_transfer', icon: Landmark },
];

export function PaymentDialog({ open, onOpenChange, total, saleType, customer, settings, loading, printOnConfirm, onConfirm }: PaymentDialogProps) {
  const { p, locale } = usePosT();
  const sym = settings.currency.symbol;
  const m = (v: number) => formatMoney(v, locale, sym);
  const [amounts, setAmounts] = React.useState<Record<string, string>>({});
  const [split, setSplit] = React.useState(false);
  const [invoiceSize, setInvoiceSize] = React.useState<InvoiceSize>('small');
  const [active, setActive] = React.useState<Exclude<PaymentMethod, 'credit'>>(settings.pos.defaultPaymentMethod === 'credit' ? 'cash' : settings.pos.defaultPaymentMethod);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setAmounts(saleType === 'cash' ? { [active]: String(total) } : {});
      setSplit(false);
      setInvoiceSize('small');
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [open, total, saleType]);

  const payments: PaymentSplit[] = Object.entries(amounts)
    .map(([method, v]) => ({ method: method as PaymentMethod, amount: round2(Number(v) || 0) }))
    .filter((x) => x.amount > 0);
  const paid = round2(payments.reduce((a, x) => a + x.amount, 0));
  const change = Math.max(0, round2(paid - total));
  const remaining = Math.max(0, round2(total - paid));
  const cashTendered = round2(payments.filter(payment => payment.method === 'cash').reduce((amount, payment) => amount + payment.amount, 0));
  const overpaid = paid > total && (saleType === 'credit' || change > cashTendered);
  const creditLimitHit = Boolean(saleType === 'credit' && customer && customer.creditLimit > 0 && customer.balance + remaining > customer.creditLimit);
  const needsCustomer = saleType === 'credit' && !customer;
  const blockedBy = total <= 0 ? p.emptyCart : needsCustomer ? p.creditRequiresCustomer : overpaid ? p.overpaid : creditLimitHit ? p.creditLimitExceeded : saleType === 'cash' && paid < total ? p.underpaid : null;
  const canConfirm = !blockedBy;

  const setAmt = (method: string, v: string) => setAmounts((a) => (split ? { ...a, [method]: v } : { [method]: v }));
  const quick = [total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100].filter((v, i, arr) => arr.indexOf(v) === i && v >= total).slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!loading) onOpenChange(value); }}>
      <DialogContent size="lg" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{p.payTitle}</span>
            <span className="text-2xl font-bold num">{m(total)}</span>
          </DialogTitle>
        </DialogHeader>
        {saleType === 'credit' ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between"><span>{p.customers}</span><span className="font-medium">{customer ? (locale === 'en' ? customer.name.en || customer.name.ar : customer.name.ar) : '—'}</span></div>
              {customer ? (
                <>
                  <div className="flex justify-between text-muted-foreground"><span>{p.balance}</span><span className="num">{m(customer.balance)}</span></div>
                  {customer.creditLimit > 0 ? <div className="flex justify-between text-muted-foreground"><span>{p.availableCredit}</span><span className={cn('num', creditLimitHit && 'text-destructive font-semibold')}>{m(Math.max(0, customer.creditLimit - customer.balance))}</span></div> : null}
                </>
              ) : null}
              {creditLimitHit ? <Badge variant="destructive" className="mt-2">{p.creditLimitExceeded}</Badge> : null}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{p.paidNow}</label>
              <Input ref={inputRef} type="number" inputMode="decimal" dir="ltr" value={amounts.cash ?? ''} onChange={(e) => setAmounts({ cash: e.target.value })} className="h-12 text-lg" />
            </div>
            <div className="flex justify-between text-sm"><span>{p.remaining}</span><span className="font-semibold num">{m(remaining)}</span></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-md border p-0.5">
                {METHODS.map(({ key, icon: Icon }) => (
                  <Button key={key} type="button" size="sm" variant={active === key ? 'default' : 'ghost'} onClick={() => { setActive(key); if (!split) setAmounts({ [key]: amounts[active] ?? String(total) }); setTimeout(() => inputRef.current?.select(), 20); }}>
                    <Icon className="size-4" /> {p[key]}
                  </Button>
                ))}
              </div>
              <Button type="button" size="xs" variant={split ? 'secondary' : 'ghost'} onClick={() => setSplit((s) => !s)}>{p.split}</Button>
            </div>
            {split ? (
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map(({ key }) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-muted-foreground">{p[key]}</label>
                    <Input type="number" inputMode="decimal" dir="ltr" value={amounts[key] ?? ''} onChange={(e) => setAmt(key, e.target.value)} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <Input ref={inputRef} type="number" inputMode="decimal" dir="ltr" value={amounts[active] ?? ''} onChange={(e) => setAmt(active, e.target.value)} className="h-14 text-2xl font-bold" onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm && !loading) onConfirm(payments, invoiceSize); }} />
                {active === 'cash' ? (
                  <div className="flex flex-wrap gap-1.5">
                    {quick.map((v) => (
                      <Button key={v} type="button" size="sm" variant="outline" onClick={() => setAmt('cash', String(v))}>{v === total ? p.exact : v}</Button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
            <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-3 text-center text-sm">
              <div><div className="text-xs text-muted-foreground">{p.paid}</div><div className="font-semibold num">{m(paid)}</div></div>
              <div><div className="text-xs text-muted-foreground">{p.remaining}</div><div className={cn('font-semibold num', remaining > 0 && 'text-destructive')}>{m(remaining)}</div></div>
              <div><div className="text-xs text-muted-foreground">{p.change}</div><div className="font-semibold num text-success">{m(change)}</div></div>
            </div>
          </div>
        )}
        {printOnConfirm ? (
          <fieldset disabled={loading} className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{p.invoiceSize}</legend>
            <div className="grid grid-cols-2 gap-2">
              {([{ size: 'small', label: p.smallInvoice, Icon: ReceiptText }, { size: 'large', label: p.largeInvoice, Icon: FileText }] as const).map(({ size, label, Icon }) => (
                <label key={size} className="cursor-pointer">
                  <input type="radio" name="invoice-size" value={size} checked={invoiceSize === size} onChange={() => setInvoiceSize(size)} className="peer sr-only" />
                  <span className="flex items-center justify-center gap-2 rounded-md border p-3 text-sm font-medium peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-50"><Icon className="size-5" />{label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{p.printerAfterConfirm}</p>
          </fieldset>
        ) : null}
        {blockedBy ? <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{blockedBy}</div> : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>{p.cancel}</Button>
          <div className="flex gap-2">
            <Button type="button" disabled={!canConfirm || loading} loading={loading} onClick={() => onConfirm(payments, invoiceSize)}>
              {printOnConfirm ? p.confirmSaleAndPrint : p.completeSale} <Kbd className="ms-1 bg-white/20 text-white">↵</Kbd>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
