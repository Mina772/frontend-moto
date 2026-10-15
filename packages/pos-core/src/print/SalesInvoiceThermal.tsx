import * as React from 'react';
import { Barcode, QrCode } from '@moto/ui';
import { CalendarClock, Coins, CreditCard, FileText, HandCoins, MapPin, Monitor, Phone, ShieldCheck, Store, UserRound, Wallet } from 'lucide-react';
import { usePosT } from '../i18n';
import { ACCENT, BORDER, DANGER, FONT_FACE_CSS, GearLogo, INVOICE_FONT_STACK, LIGHT, MUTED, Moto, NAVY, TEXT, scaler } from './invoiceTheme';
import { computeInvoiceTotals, formatAmount, formatCurrency, formatInvoiceDate, type Invoice, type StoreProfile } from './invoiceModel';

export interface SalesInvoiceThermalProps {
  invoice: Invoice;
  store: StoreProfile;
  /** Roll width in millimetres. */
  widthMm: 58 | 80;
  /** Drops the warranty notes and brand strip to save paper. */
  compact?: boolean;
}

// Type scales gently with the roll width — a linear 58/80 ratio would drop the body text below legibility.
const typeScale = (widthMm: number) => (widthMm <= 58 ? 0.86 : 1);

const sheet = (widthMm: number) => {
  const { px, mm } = scaler(typeScale(widthMm));
  const pad = widthMm <= 58 ? 2.5 : 3.5;
  return `${FONT_FACE_CSS}
.mpt, .mpt * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.mpt { position: relative; width: ${widthMm}mm; background: #fff; color: ${TEXT}; overflow: hidden;
  font-family: ${INVOICE_FONT_STACK}; font-size: ${px(11)}; line-height: 1.4;
  display: flex; flex-direction: column; gap: ${mm(1.6)}; padding-bottom: ${mm(3)}; text-align: start; }
.mpt svg { display: inline-block; vertical-align: middle; flex-shrink: 0; }
.mpt img { display: block; }
.mpt h1, .mpt h4, .mpt ul, .mpt p { margin: 0; padding: 0; }
.mpt-num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
.mpt-table td.item, .mpt-warranty li { unicode-bidi: plaintext; }
.mpt-pad { padding-inline: ${pad}mm; }

.mpt-head { background: ${NAVY}; color: #fff; padding: ${mm(2.5)} ${pad}mm ${mm(2.2)}; display: flex; flex-direction: column; align-items: center; gap: ${mm(1)}; text-align: center; }
.mpt-logo { width: ${mm(13)}; height: ${mm(13)}; }
.mpt-logo img { width: 100%; height: 100%; object-fit: contain; }
.mpt-name { font-size: ${px(19)}; font-weight: 900; line-height: 1.1; letter-spacing: ${px(-0.2)}; }
.mpt-subtitle { font-size: ${px(10.5)}; font-weight: 700; opacity: .92; }
.mpt-tagline { font-size: ${px(9.5)}; font-weight: 700; color: #BFD2F0; letter-spacing: ${px(0.2)}; }

.mpt-contact { display: flex; flex-direction: column; align-items: center; gap: ${mm(0.5)}; text-align: center; font-size: ${px(10)}; font-weight: 700; }
.mpt-contact .grp { display: inline-flex; align-items: center; gap: ${mm(1.2)}; }
.mpt-contact .tax { font-size: ${px(9)}; font-weight: 600; color: ${MUTED}; }

.mpt-brands { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: ${mm(1)} ${mm(2.2)}; direction: ltr;
  border-top: 1px solid ${BORDER}; border-bottom: 1px solid ${BORDER}; padding: ${mm(1)} ${pad}mm; }
.mpt-brand-item { font-family: 'Arial Black', 'Segoe UI', Arial, sans-serif; font-weight: 900; font-style: italic; font-size: ${px(9.5)}; letter-spacing: ${px(0.3)}; }
.mpt-brand-item img { height: ${mm(4)}; width: auto; }

.mpt-banner { display: flex; align-items: center; justify-content: space-between; gap: ${mm(2)}; background: ${NAVY}; color: #fff; padding: ${mm(1.2)} ${pad}mm; }
.mpt-banner .ttl { display: inline-flex; align-items: center; gap: ${mm(1.5)}; font-size: ${px(13.5)}; font-weight: 900; }
.mpt-banner .no { background: ${LIGHT}; color: ${NAVY}; border-radius: ${px(5)}; padding: ${mm(0.5)} ${mm(2)}; font-size: ${px(12.5)}; font-weight: 900; }

.mpt-rows { display: flex; flex-direction: column; gap: ${mm(0.8)}; }
.mpt-row { display: flex; align-items: center; justify-content: space-between; gap: ${mm(2)}; background: ${LIGHT}; border-radius: ${px(5)}; padding: ${mm(0.8)} ${mm(2)}; }
.mpt-row .lbl { display: inline-flex; align-items: center; gap: ${mm(1.2)}; color: ${MUTED}; font-weight: 700; white-space: nowrap; }
.mpt-row .val { font-weight: 800; text-align: end; }

.mpt-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.mpt-table thead { display: table-header-group; }
.mpt-table th { background: ${NAVY}; color: #fff; font-weight: 800; font-size: ${px(10)}; padding: ${mm(1)} ${mm(0.8)}; text-align: center; line-height: 1.2; }
.mpt-table th.item { text-align: start; padding-inline-start: ${mm(1.5)}; }
.mpt-table td { padding: ${mm(0.9)} ${mm(0.8)}; text-align: center; font-weight: 700; font-size: ${px(10.5)}; border-top: 1px solid #E6ECF4; vertical-align: top; }
.mpt-table tbody tr:nth-child(even) td { background: ${LIGHT}; }
.mpt-table tr { break-inside: avoid; page-break-inside: avoid; }
.mpt-table td.idx { color: ${NAVY}; font-weight: 900; }
.mpt-table td.item { text-align: start; padding-inline-start: ${mm(1.5)}; }
.mpt-table td.item .note { display: block; font-size: ${px(9)}; color: ${MUTED}; font-weight: 600; }
.mpt-table td.item .note.disc { color: ${DANGER}; }
.mpt-table td.total { font-weight: 900; color: ${NAVY}; }
.mpt-empty td { height: ${mm(8)}; color: ${MUTED}; }

.mpt-totals { display: flex; flex-direction: column; gap: ${mm(0.3)}; }
.mpt-trow { display: flex; justify-content: space-between; align-items: center; font-size: ${px(11)}; font-weight: 700; padding: ${mm(0.3)} ${mm(1)}; }
.mpt-trow .val { font-weight: 900; }
.mpt-trow.disc .val { color: ${DANGER}; }
.mpt-grand { display: flex; justify-content: space-between; align-items: center; gap: ${mm(2)}; margin-top: ${mm(0.8)}; background: ${NAVY}; color: #fff; border-radius: ${px(6)}; padding: ${mm(1.3)} ${mm(2.5)}; }
.mpt-grand .lbl { display: inline-flex; align-items: center; gap: ${mm(1.2)}; font-size: ${px(12)}; font-weight: 900; }
.mpt-grand .val { font-size: ${px(15)}; font-weight: 900; }

.mpt-codes { display: flex; flex-direction: column; align-items: center; gap: ${mm(0.8)}; text-align: center; color: #000; }
.mpt-codes .cap { font-size: ${px(9)}; font-weight: 700; color: ${MUTED}; }
.mpt-codes .bc-no { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: ${px(10)}; letter-spacing: ${px(0.8)}; }

.mpt-warranty h4 { display: flex; align-items: center; gap: ${mm(1.2)}; margin-bottom: ${mm(0.8)}; color: ${NAVY}; font-size: ${px(10.5)}; font-weight: 900; }
.mpt-warranty ul { list-style: none; display: flex; flex-direction: column; gap: ${mm(0.5)}; }
.mpt-warranty li { position: relative; padding-inline-start: ${mm(3)}; font-size: ${px(9)}; font-weight: 600; }
.mpt-warranty li::before { content: ''; position: absolute; inset-inline-start: ${mm(0.6)}; top: .62em; width: ${mm(1.2)}; height: ${mm(1.2)}; border-radius: 50%; background: ${NAVY}; }

.mpt-sign { display: flex; flex-direction: column; align-items: center; gap: ${mm(1.2)}; break-inside: avoid; }
.mpt-stamp { position: relative; width: ${mm(22)}; height: ${mm(22)}; border-radius: 50%; border: 1.4px solid ${ACCENT}; box-shadow: inset 0 0 0 ${mm(0.9)} #fff, inset 0 0 0 ${mm(1.2)} ${ACCENT};
  color: ${ACCENT}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transform: rotate(-7deg); opacity: .9; padding: ${mm(2)}; }
.mpt-stamp .s-name { font-size: ${px(10)}; font-weight: 900; line-height: 1.1; white-space: nowrap; }
.mpt-stamp .s-sub { max-width: ${mm(16)}; font-size: ${px(5.5)}; font-weight: 700; line-height: 1.2; }
.mpt-stamp .s-star { font-size: ${px(7)}; line-height: 1; margin-top: ${mm(0.3)}; }
.mpt-reviewed { border: 1.6px solid ${ACCENT}; outline: 1px solid ${ACCENT}; outline-offset: 1px; color: ${ACCENT}; border-radius: ${px(4)}; padding: ${mm(0.2)} ${mm(3)}; font-size: ${px(11)}; font-weight: 900; transform: rotate(-4deg); opacity: .9; }
.mpt-sign-box { width: 100%; }
.mpt-sign-box h5 { margin: 0 0 ${mm(0.6)}; font-size: ${px(10)}; font-weight: 900; color: ${NAVY}; }
.mpt-sign-area { height: ${mm(7)}; border-bottom: 1.2px dashed #9AA8BD; }

.mpt-bar { background: ${NAVY}; color: #fff; padding: ${mm(1.6)} ${pad}mm; display: flex; flex-direction: column; align-items: center; gap: ${mm(0.6)}; text-align: center; break-inside: avoid; }
.mpt-bar .thanks { display: flex; align-items: center; gap: ${mm(2)}; font-size: ${px(12.5)}; font-weight: 900; }
.mpt-bar .thanks::before, .mpt-bar .thanks::after { content: ''; width: ${mm(5)}; height: 1.2px; background: rgba(255,255,255,.7); }
.mpt-bar .addr { font-size: ${px(9.5)}; font-weight: 700; opacity: .9; }
@media print { .mpt { margin: 0; box-shadow: none; } }
`;
};

/** Thermal roll receipt carrying the A4 invoice's visual identity in a single narrow column. */
export const SalesInvoiceThermal = React.forwardRef<HTMLDivElement, SalesInvoiceThermalProps>(function SalesInvoiceThermal(
  { invoice, store, widthMm, compact = false },
  ref,
) {
  const { p, locale, dir } = usePosT();
  const L = p.invoiceA4;
  const css = React.useMemo(() => sheet(widthMm), [widthMm]);
  const { ic, n: sz } = scaler(typeScale(widthMm));
  const totals = React.useMemo(() => computeInvoiceTotals(invoice), [invoice]);
  const dec = invoice.currency.decimals ?? 2;
  const n = (v: number) => formatAmount(v, dec);
  const m = (v: number) => formatCurrency(v, invoice.currency);
  const when = formatInvoiceDate(invoice.issuedAt, locale);
  const sym = invoice.currency.symbol;
  const [first, ...rest] = store.name.trim().split(/\s+/);
  const taxPct = Math.round(invoice.taxRate * 10000) / 100;

  return (
    <div ref={ref} dir={dir} lang={locale} className="mpt receipt">
      <style>{css}</style>

      <header className="mpt-head">
        <div className="mpt-logo">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : <GearLogo ring="#fff" hub={NAVY} />}</div>
        <h1 className="mpt-name">{first} {rest.join(' ')}</h1>
        <div className="mpt-subtitle">{store.subtitle}</div>
        <div className="mpt-tagline">{store.tagline}</div>
      </header>

      <div className="mpt-contact mpt-pad">
        {store.phones.length ? (
          <span className="grp mpt-num"><Phone size={ic(11)} strokeWidth={2.4} /> {store.phones.join('  |  ')}</span>
        ) : null}
        <span className="grp"><MapPin size={ic(11)} strokeWidth={2.2} /> {store.address}</span>
        {store.taxNumber ? <span className="tax">{L.taxNo}: <span className="mpt-num">{store.taxNumber}</span></span> : null}
      </div>

      {!compact && store.brandLogos.length ? (
        <div className="mpt-brands">
          {store.brandLogos.map((b) => (
            <span key={b.name} className="mpt-brand-item" style={{ color: b.color }}>
              {b.logoUrl ? <img src={b.logoUrl} alt={b.name} /> : b.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mpt-banner">
        <span className="ttl"><FileText size={ic(15)} strokeWidth={2} /> {L.title}</span>
        <span className="no mpt-num">{invoice.number}</span>
      </div>

      <div className="mpt-rows mpt-pad">
        <div className="mpt-row">
          <span className="lbl"><CalendarClock size={ic(12)} /> {L.dateTime}</span>
          <span className="val"><span className="mpt-num">{when.date}</span>&nbsp;<span className="mpt-num">{when.time}</span></span>
        </div>
        <div className="mpt-row"><span className="lbl"><UserRound size={ic(12)} /> {L.customerName}</span><span className="val">{invoice.customer.name}</span></div>
        {invoice.customer.balance !== undefined ? (
          <div className="mpt-row"><span className="lbl"><Coins size={ic(12)} /> {L.balance}</span><span className="val mpt-num">{m(invoice.customer.balance)}</span></div>
        ) : null}
        <div className="mpt-row"><span className="lbl"><Store size={ic(12)} /> {L.branch}</span><span className="val">{invoice.branch}</span></div>
        {invoice.cashier ? <div className="mpt-row"><span className="lbl"><UserRound size={ic(12)} /> {L.cashier}</span><span className="val">{invoice.cashier}</span></div> : null}
        {invoice.terminal ? <div className="mpt-row"><span className="lbl"><Monitor size={ic(12)} /> {p.receipt.terminal}</span><span className="val mpt-num">{invoice.terminal}</span></div> : null}
      </div>

      <table className="mpt-table">
        <colgroup>
          <col style={{ width: '8%' }} />
          <col style={{ width: '46%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          {/* Short receipt labels — the A4 wording wraps to two lines on a 58mm roll. */}
          <tr>
            <th>{L.index}</th>
            <th className="item">{p.receipt.item}</th>
            <th>{p.receipt.qty}</th>
            <th>{p.receipt.price}</th>
            <th>{p.receipt.total}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.length ? (
            invoice.items.map((it, i) => (
              <tr key={i}>
                <td className="idx mpt-num">{i + 1}</td>
                <td className="item">
                  {it.name}
                  {!compact && it.sku ? <span className="note mpt-num">{it.sku}</span> : null}
                  {it.note ? <span className="note">{it.note}</span> : null}
                  {it.discount > 0 ? <span className="note disc mpt-num">{L.discount}: -{n(it.discount)} {sym}</span> : null}
                </td>
                <td className="mpt-num">{it.qty}</td>
                <td className="mpt-num">{n(it.unitPrice)}</td>
                <td className="total mpt-num">{n(totals.lineTotals[i] ?? 0)}</td>
              </tr>
            ))
          ) : (
            <tr className="mpt-empty"><td colSpan={5}>—</td></tr>
          )}
        </tbody>
      </table>

      <div className="mpt-totals mpt-pad">
        <div className="mpt-trow"><span>{L.subtotal}</span><span className="val mpt-num">{m(totals.subtotal)}</span></div>
        {totals.invoiceDiscount > 0 ? (
          <div className="mpt-trow disc"><span>{L.invoiceDiscount}</span><span className="val mpt-num">-{m(totals.invoiceDiscount)}</span></div>
        ) : null}
        {invoice.taxRate > 0 ? (
          <div className="mpt-trow"><span>{L.tax} (<span className="mpt-num">{taxPct}%</span>)</span><span className="val mpt-num">{m(totals.tax)}</span></div>
        ) : null}
        <div className="mpt-grand"><span className="lbl"><Coins size={ic(14)} /> {L.grandTotal}</span><span className="val mpt-num">{m(totals.grandTotal)}</span></div>
      </div>

      <div className="mpt-rows mpt-pad">
        <div className="mpt-row"><span className="lbl"><Wallet size={ic(12)} /> {L.paid}</span><span className="val mpt-num">{m(totals.paid)}</span></div>
        {totals.change > 0 ? (
          <div className="mpt-row"><span className="lbl"><HandCoins size={ic(12)} /> {L.change}</span><span className="val mpt-num">{m(totals.change)}</span></div>
        ) : (
          <div className="mpt-row"><span className="lbl"><HandCoins size={ic(12)} /> {L.remaining}</span><span className="val mpt-num">{m(totals.remaining)}</span></div>
        )}
        <div className="mpt-row"><span className="lbl"><CreditCard size={ic(12)} /> {L.paymentMethod}</span><span className="val">{invoice.paymentMethod}</span></div>
      </div>

      {invoice.showBarcode !== false || invoice.qrUrl ? (
        <div className="mpt-codes mpt-pad">
          {invoice.showBarcode !== false ? (
            <>
              <Barcode value={invoice.number} height={sz(30)} barWidth={widthMm <= 58 ? 0.9 : 1.1} showText={false} />
              <div className="bc-no mpt-num">{invoice.number}</div>
            </>
          ) : null}
          {invoice.qrUrl ? (
            <>
              <QrCode value={invoice.qrUrl} size={ic(widthMm <= 58 ? 72 : 88)} />
              <div className="cap">{L.scanQr}</div>
            </>
          ) : null}
        </div>
      ) : null}

      {!compact && store.warrantyNotes.length ? (
        <div className="mpt-warranty mpt-pad">
          <h4><ShieldCheck size={ic(13)} /> {L.warrantyTitle}</h4>
          <ul>
            {store.warrantyNotes.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mpt-sign mpt-pad">
        {invoice.stamped === false ? null : (
          <div className="mpt-stamp" aria-hidden>
            <div style={{ width: `${sz(7)}mm`, height: `${sz(4.5)}mm`, color: ACCENT }}><Moto /></div>
            <div className="s-name">{store.name}</div>
            <div className="s-sub">{store.subtitle}</div>
            <div className="s-star">★</div>
          </div>
        )}
        {invoice.reviewed ? <span className="mpt-reviewed">{L.reviewed}</span> : null}
        <div className="mpt-sign-box">
          <h5>{L.customerSignature}</h5>
          <div className="mpt-sign-area" />
        </div>
      </div>

      <footer className="mpt-bar">
        <span className="thanks">{store.thanks}</span>
        <span className="addr">{store.address}</span>
      </footer>
    </div>
  );
});
