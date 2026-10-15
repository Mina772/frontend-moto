import * as React from 'react';
import { Barcode, QrCode } from '@moto/ui';
import { CalendarClock, Coins, CreditCard, FileText, HandCoins, MapPin, Monitor, Phone, ShieldCheck, Store, UserRound, Wallet } from 'lucide-react';
import { usePosT } from '../i18n';
import { ACCENT, BORDER, DANGER, FONT_FACE_CSS, GearLogo, INVOICE_FONT_STACK, LIGHT, MUTED, Moto, NAVY, TEXT, scaler } from './invoiceTheme';
import { computeInvoiceTotals, formatAmount, formatCurrency, formatInvoiceDate, type Invoice, type StoreProfile } from './invoiceModel';

export interface SalesInvoiceA4Props {
  invoice: Invoice;
  store: StoreProfile;
  /**
   * Uniform multiplier for every length in the sheet. A5 is A4 ÷ √2 on both axes, so `1 / Math.SQRT2`
   * reproduces the design exactly on A5 while still reflowing and paginating normally.
   */
  scale?: number;
}

const sheet = (s: number) => {
  const { px, mm } = scaler(s);
  return `${FONT_FACE_CSS}
.mpi, .mpi * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.mpi { position: relative; width: ${mm(210)}; min-height: ${mm(297)}; padding: ${mm(8)} ${mm(10)} 0; overflow: hidden; background: #fff; color: ${TEXT};
  font-family: ${INVOICE_FONT_STACK}; font-size: ${px(11.5)}; line-height: 1.45;
  display: flex; flex-direction: column; gap: ${mm(2.5)}; text-align: start; }
.mpi svg { display: inline-block; vertical-align: middle; flex-shrink: 0; }
.mpi img { display: block; }
.mpi p, .mpi h1, .mpi ul { margin: 0; padding: 0; }
.mpi-num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
.mpi-table td.item, .mpi-warranty li { unicode-bidi: plaintext; }
.mpi-corner { position: absolute; z-index: 0; pointer-events: none; }
.mpi-corner.tr { top: 0; right: 0; width: ${mm(30)}; height: ${mm(9)}; background: linear-gradient(135deg, ${ACCENT}, ${NAVY}); clip-path: polygon(0 0, 100% 0, 100% 100%); }
.mpi-corner.tr2 { top: 0; right: 0; width: ${mm(42)}; height: ${mm(13)}; background: ${NAVY}; opacity: .12; clip-path: polygon(0 0, 100% 0, 100% 100%); }
.mpi-corner.bl { bottom: ${mm(9)}; left: 0; width: ${mm(30)}; height: ${mm(9)}; background: linear-gradient(315deg, ${ACCENT}, ${NAVY}); clip-path: polygon(0 0, 0 100%, 100% 100%); }
.mpi-corner.bl2 { bottom: ${mm(9)}; left: 0; width: ${mm(42)}; height: ${mm(13)}; background: ${NAVY}; opacity: .12; clip-path: polygon(0 0, 0 100%, 100% 100%); }
.mpi > *:not(.mpi-corner) { position: relative; z-index: 1; }

.mpi-header { display: flex; align-items: center; justify-content: space-between; gap: ${mm(6)}; padding-top: ${mm(1)}; }
.mpi-brand { display: flex; align-items: center; gap: ${mm(4)}; }
.mpi-logo { width: ${mm(23)}; height: ${mm(23)}; }
.mpi-logo img { width: 100%; height: 100%; object-fit: contain; }
.mpi-name { font-size: ${px(34)}; font-weight: 900; line-height: 1.1; color: ${NAVY}; letter-spacing: ${px(-0.3)}; white-space: nowrap; }
.mpi-name .acc { color: ${ACCENT}; }
.mpi-subtitle { display: flex; align-items: center; gap: ${mm(2.5)}; font-size: ${px(15)}; font-weight: 800; color: ${TEXT}; margin-top: ${mm(0.5)}; white-space: nowrap; }
.mpi-subtitle::before, .mpi-subtitle::after { content: ''; width: ${mm(7)}; height: 1.4px; background: ${NAVY}; }
.mpi-tagline { text-align: center; font-size: ${px(12.5)}; font-weight: 700; color: ${ACCENT}; letter-spacing: ${px(0.3)}; }
.mpi-contact { position: relative; display: flex; flex-direction: column; gap: ${mm(1.6)}; padding-inline-start: ${mm(5)}; border-inline-start: 1.4px solid ${BORDER}; min-width: ${mm(62)}; }
.mpi-contact-row { display: flex; align-items: center; gap: ${mm(2.5)}; font-size: ${px(13)}; font-weight: 700; }
.mpi-contact-row.addr { font-size: ${px(12)}; align-items: flex-start; }
.mpi-ico { display: inline-flex; align-items: center; justify-content: center; width: ${mm(6.5)}; height: ${mm(6.5)}; border-radius: 50%; background: ${NAVY}; color: #fff; }
.mpi-ico.plain { background: transparent; color: ${NAVY}; }
.mpi-watermark { position: absolute; inset-inline-end: ${mm(-4)}; top: ${mm(-6)}; width: ${mm(48)}; height: ${mm(30)}; color: ${NAVY}; opacity: .07; pointer-events: none; }
.mpi-taxno { font-size: ${px(10.5)}; color: ${MUTED}; font-weight: 600; }

.mpi-brands { display: flex; align-items: center; justify-content: space-between; gap: ${mm(3)}; padding: ${mm(1.6)} ${mm(3)}; border-top: 1px solid ${BORDER}; border-bottom: 1px solid ${BORDER}; }
.mpi-brand-list { display: flex; align-items: center; direction: ltr; }
.mpi-brand-item { padding: 0 ${mm(4)}; font-family: 'Arial Black', 'Segoe UI', Arial, sans-serif; font-weight: 900; font-style: italic; font-size: ${px(13)}; letter-spacing: ${px(0.4)}; border-inline-start: 1px solid ${BORDER}; }
.mpi-brand-item:first-child { border-inline-start: 0; padding-inline-start: 0; }
.mpi-brand-item img { height: ${mm(6)}; width: auto; }
.mpi-slogan { font-size: ${px(13)}; font-weight: 800; color: ${NAVY}; white-space: nowrap; }

.mpi-info { display: grid; grid-template-columns: 1.12fr 1fr; gap: ${mm(4)}; }
.mpi-card { border: 1px solid ${BORDER}; border-radius: ${px(8)}; overflow: hidden; background: #fff; }
.mpi-banner { display: flex; align-items: stretch; justify-content: space-between; background: ${NAVY}; color: #fff; }
.mpi-banner-title { display: flex; align-items: center; gap: ${mm(2.5)}; padding: ${mm(1.5)} ${mm(4)}; font-size: ${px(21)}; font-weight: 900; }
.mpi-banner-no { display: flex; flex-direction: column; justify-content: center; align-items: flex-end; background: ${LIGHT}; color: ${NAVY}; padding: ${mm(0.8)} ${mm(4)}; margin: ${mm(1.2)}; border-radius: ${px(6)}; min-width: ${mm(40)}; }
.mpi-banner-no small { font-size: ${px(10)}; color: ${MUTED}; font-weight: 600; }
.mpi-banner-no b { font-size: ${px(18)}; font-weight: 900; line-height: 1.15; }
.mpi-rows { display: flex; flex-direction: column; gap: ${mm(1)}; padding: ${mm(1.5)}; }
.mpi-row { display: flex; align-items: center; justify-content: space-between; gap: ${mm(3)}; background: ${LIGHT}; border-radius: ${px(6)}; padding: ${mm(1)} ${mm(3)}; min-height: ${mm(6.8)}; }
.mpi-row .lbl { display: inline-flex; align-items: center; gap: ${mm(2)}; color: ${MUTED}; font-weight: 600; white-space: nowrap; }
.mpi-row .lbl.strong { color: ${NAVY}; font-weight: 800; font-size: ${px(12.5)}; }
.mpi-row .val { font-weight: 800; color: ${TEXT}; text-align: end; }
.mpi-info .mpi-card.meta .mpi-rows { height: 100%; justify-content: space-around; }

.mpi-table-wrap { border: 1px solid ${BORDER}; border-radius: ${px(8)}; overflow: hidden; }
.mpi-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.mpi-table thead { display: table-header-group; }
.mpi-table th { background: ${NAVY}; color: #fff; font-weight: 800; font-size: ${px(12.5)}; padding: ${mm(1.5)} ${mm(1.5)}; text-align: center; line-height: 1.25; border-inline-start: 1px solid rgba(255,255,255,.18); }
.mpi-table th:first-child { border-inline-start: 0; }
.mpi-table th small { display: block; font-size: ${px(9.5)}; font-weight: 600; opacity: .85; }
.mpi-table th.item { text-align: start; padding-inline-start: ${mm(3)}; }
.mpi-table td { padding: ${mm(1.15)} ${mm(1.5)}; text-align: center; font-weight: 700; border-top: 1px solid #E6ECF4; border-inline-start: 1px solid #EEF2F8; vertical-align: middle; }
.mpi-table td:first-child { border-inline-start: 0; }
.mpi-table tbody tr:nth-child(even) td { background: ${LIGHT}; }
.mpi-table tr { break-inside: avoid; page-break-inside: avoid; }
.mpi-table td.idx { color: ${NAVY}; font-weight: 900; }
.mpi-table td.item { text-align: start; padding-inline-start: ${mm(3)}; font-weight: 700; }
.mpi-table td.item .note { display: block; font-size: ${px(9.5)}; color: ${MUTED}; font-weight: 600; }
.mpi-table td.code { font-weight: 600; font-size: ${px(11)}; color: #33415C; letter-spacing: ${px(0.2)}; }
.mpi-table td.total { font-weight: 900; color: ${NAVY}; }
.mpi-empty td { height: ${mm(12)}; color: ${MUTED}; }

.mpi-sum { display: grid; grid-template-columns: 1fr 1.12fr; gap: ${mm(4)}; align-items: stretch; break-inside: avoid; }
.mpi-pay .mpi-rows { height: 100%; justify-content: space-between; padding: ${mm(1.6)}; gap: ${mm(1.2)}; }
.mpi-pay .mpi-row { min-height: ${mm(8)}; }
.mpi-pay .mpi-row .val { font-size: ${px(15)}; font-weight: 900; }
.mpi-pay .mpi-row .val.small { font-size: ${px(13)}; font-weight: 800; }
.mpi-totals { display: flex; flex-direction: column; padding: ${mm(1.8)} ${mm(3)}; gap: ${mm(0.4)}; }
.mpi-trow { display: flex; justify-content: space-between; align-items: center; font-size: ${px(13)}; font-weight: 700; padding: ${mm(0.6)} ${mm(1)}; }
.mpi-trow .val { font-weight: 900; font-size: ${px(14)}; }
.mpi-trow.disc .val { color: ${DANGER}; }
.mpi-grand { display: flex; justify-content: space-between; align-items: center; margin-top: ${mm(1.2)}; background: ${NAVY}; color: #fff; border-radius: ${px(7)}; padding: ${mm(1.8)} ${mm(4)}; }
.mpi-grand .lbl { display: inline-flex; align-items: center; gap: ${mm(2)}; font-size: ${px(16)}; font-weight: 900; }
.mpi-grand .val { font-size: ${px(21)}; font-weight: 900; }

.mpi-footer { display: grid; grid-template-columns: 1.55fr 1fr .85fr; border: 1px solid ${BORDER}; border-radius: ${px(8)}; overflow: hidden; break-inside: avoid; }
.mpi-footer > div { padding: ${mm(2)} ${mm(4)}; display: flex; flex-direction: column; justify-content: center; }
.mpi-footer > div + div { border-inline-start: 1px solid ${BORDER}; }
.mpi-warranty h4 { display: flex; align-items: center; gap: ${mm(2)}; margin: 0 0 ${mm(1.2)}; color: ${NAVY}; font-size: ${px(13.5)}; font-weight: 900; }
.mpi-warranty ul { list-style: none; display: flex; flex-direction: column; gap: ${mm(0.8)}; }
.mpi-warranty li { position: relative; padding-inline-start: ${mm(4)}; font-size: ${px(11.5)}; font-weight: 600; }
.mpi-warranty li::before { content: ''; position: absolute; inset-inline-start: ${mm(0.5)}; top: .62em; width: ${mm(1.6)}; height: ${mm(1.6)}; border-radius: 50%; background: ${NAVY}; }
.mpi-codes { align-items: center; text-align: center; color: #000; }
.mpi-codes .cap { font-size: ${px(10)}; font-weight: 700; color: ${MUTED}; margin-top: ${mm(1)}; }
.mpi-codes .bc-no { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: ${px(12)}; letter-spacing: ${px(1)}; margin-top: ${mm(0.6)}; }

.mpi-sign { display: grid; grid-template-columns: 1fr ${mm(30)} 1fr; gap: ${mm(6)}; align-items: center; break-inside: avoid; padding: 0 ${mm(2)}; }
.mpi-sign-box { display: flex; flex-direction: column; gap: ${mm(1.2)}; }
.mpi-sign-box h5 { margin: 0; font-size: ${px(13)}; font-weight: 900; color: ${NAVY}; }
.mpi-sign-area { position: relative; height: ${mm(9)}; border-bottom: 1.2px dashed #9AA8BD; display: flex; align-items: center; justify-content: center; }
.mpi-sign-line { display: flex; gap: ${mm(2)}; font-size: ${px(11)}; font-weight: 600; color: ${MUTED}; }
.mpi-sign-line .dots { flex: 1; border-bottom: 1px dotted #9AA8BD; min-height: ${mm(3.6)}; color: ${TEXT}; font-weight: 700; }
.mpi-stamp { position: relative; width: ${mm(28)}; height: ${mm(28)}; border-radius: 50%; border: 1.6px solid ${ACCENT}; box-shadow: inset 0 0 0 ${mm(1.1)} #fff, inset 0 0 0 ${mm(1.5)} ${ACCENT};
  color: ${ACCENT}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transform: rotate(-7deg); opacity: .9; margin: 0 auto; padding: ${mm(3)}; }
.mpi-stamp .s-name { font-size: ${px(13)}; font-weight: 900; line-height: 1.1; white-space: nowrap; }
.mpi-stamp .s-sub { max-width: ${mm(20)}; font-size: ${px(6)}; font-weight: 700; line-height: 1.25; }
.mpi-stamp .s-addr { max-width: ${mm(19)}; overflow: hidden; text-overflow: ellipsis; font-size: ${px(6)}; font-weight: 600; border-top: 1px solid ${ACCENT}; margin-top: ${mm(0.6)}; padding-top: ${mm(0.4)}; line-height: 1.3; white-space: nowrap; }
.mpi-stamp .s-star { font-size: ${px(8)}; line-height: 1; margin-top: ${mm(0.4)}; }
.mpi-reviewed { border: 2px solid ${ACCENT}; outline: 1px solid ${ACCENT}; outline-offset: 1px; color: ${ACCENT}; border-radius: ${px(4)}; padding: ${mm(0.3)} ${mm(4)}; font-size: ${px(15)}; font-weight: 900; transform: rotate(-4deg); opacity: .9; }

.mpi-bar { margin: 0 ${mm(-10)}; display: flex; align-items: center; justify-content: space-between; gap: ${mm(4)}; background: ${NAVY}; color: #fff; padding: ${mm(2)} ${mm(10)}; font-size: ${px(11.5)}; font-weight: 700; break-inside: avoid; }
.mpi-bar .thanks { display: flex; align-items: center; gap: ${mm(3)}; font-size: ${px(15)}; font-weight: 900; }
.mpi-bar .thanks::before, .mpi-bar .thanks::after { content: ''; width: ${mm(9)}; height: 1.4px; background: rgba(255,255,255,.7); }
.mpi-bar .grp { display: inline-flex; align-items: center; gap: ${mm(1.5)}; }
.mpi-bottom { margin-top: auto; display: flex; flex-direction: column; gap: ${mm(2.5)}; }
@media print { .mpi { margin: 0; box-shadow: none; } }
`;
};

/** Pixel-oriented A4 RTL sales invoice. All markup and styles are self-contained for silent Electron printing. */
export const SalesInvoiceA4 = React.forwardRef<HTMLDivElement, SalesInvoiceA4Props>(function SalesInvoiceA4({ invoice, store, scale = 1 }, ref) {
  const { p, locale, dir } = usePosT();
  const L = p.invoiceA4;
  const css = React.useMemo(() => sheet(scale), [scale]);
  const { ic, n: sz } = scaler(scale);
  const totals = React.useMemo(() => computeInvoiceTotals(invoice), [invoice]);
  const dec = invoice.currency.decimals ?? 2;
  const n = (v: number) => formatAmount(v, dec);
  const m = (v: number) => formatCurrency(v, invoice.currency);
  const when = formatInvoiceDate(invoice.issuedAt, locale);
  const sym = invoice.currency.symbol;
  const [first, ...rest] = store.name.trim().split(/\s+/);
  const taxPct = Math.round(invoice.taxRate * 10000) / 100;

  return (
    <div ref={ref} dir={dir} lang={locale} className="mpi invoice">
      <style>{css}</style>
      <span className="mpi-corner tr2" />
      <span className="mpi-corner tr" />
      <span className="mpi-corner bl2" />
      <span className="mpi-corner bl" />

      <header className="mpi-header">
        <div className="mpi-brand">
          <div className="mpi-logo">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : <GearLogo />}</div>
          <div>
            <h1 className="mpi-name">
              {first} {rest.length ? <span className="acc">{rest.join(' ')}</span> : null}
            </h1>
            <div className="mpi-subtitle">{store.subtitle}</div>
            <div className="mpi-tagline">{store.tagline}</div>
          </div>
        </div>
        <div className="mpi-contact">
          <Moto className="mpi-watermark" />
          {store.phones.map((ph) => (
            <div key={ph} className="mpi-contact-row">
              <span className="mpi-ico"><Phone size={ic(13)} strokeWidth={2.4} /></span>
              <span className="mpi-num">{ph}</span>
            </div>
          ))}
          <div className="mpi-contact-row addr">
            <span className="mpi-ico plain"><MapPin size={ic(20)} strokeWidth={2.2} /></span>
            <span>{store.address}</span>
          </div>
          {store.taxNumber ? <div className="mpi-taxno">{L.taxNo}: <span className="mpi-num">{store.taxNumber}</span></div> : null}
        </div>
      </header>

      <section className="mpi-brands">
        <div className="mpi-brand-list">
          {store.brandLogos.map((b) => (
            <span key={b.name} className="mpi-brand-item" style={{ color: b.color }}>
              {b.logoUrl ? <img src={b.logoUrl} alt={b.name} /> : b.name}
            </span>
          ))}
        </div>
        <span className="mpi-slogan">{store.slogan}</span>
      </section>

      <section className="mpi-info">
        <div className="mpi-card">
          <div className="mpi-banner">
            <div className="mpi-banner-title"><FileText size={ic(24)} strokeWidth={2} /> {L.title}</div>
            <div className="mpi-banner-no">
              <small>{L.invoiceNo}</small>
              <b className="mpi-num">{invoice.number}</b>
            </div>
          </div>
          <div className="mpi-rows">
            <div className="mpi-row"><span className="lbl">{L.customerName}</span><span className="val">{invoice.customer.name}</span></div>
            <div className="mpi-row"><span className="lbl">{L.saleType}</span><span className="val">{invoice.customer.saleType === 'credit' ? p.credit : p.cash}</span></div>
            <div className="mpi-row"><span className="lbl">{L.customerNo}</span><span className="val mpi-num">{invoice.customer.id || '—'}</span></div>
            {invoice.customer.balance !== undefined ? (
              <div className="mpi-row"><span className="lbl">{L.balance}</span><span className="val mpi-num">{m(invoice.customer.balance)}</span></div>
            ) : null}
          </div>
        </div>
        <div className="mpi-card meta">
          <div className="mpi-rows">
            <div className="mpi-row">
              <span className="lbl strong"><CalendarClock size={ic(16)} /> {L.dateTime}</span>
              <span className="val"><span className="mpi-num">{when.date}</span>&nbsp;&nbsp;<span className="mpi-num">{when.time}</span></span>
            </div>
            <div className="mpi-row"><span className="lbl strong"><Store size={ic(16)} /> {L.branch}</span><span className="val">{invoice.branch}</span></div>
            {invoice.cashier ? <div className="mpi-row"><span className="lbl strong"><UserRound size={ic(16)} /> {L.cashier}</span><span className="val">{invoice.cashier}</span></div> : null}
            {invoice.terminal ? <div className="mpi-row"><span className="lbl strong"><Monitor size={ic(16)} /> {p.receipt.terminal}</span><span className="val mpi-num">{invoice.terminal}</span></div> : null}
          </div>
        </div>
      </section>

      <div className="mpi-table-wrap">
        <table className="mpi-table">
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '33%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>{L.index}</th>
              <th className="item">{L.item}</th>
              <th>{L.code}</th>
              <th>{L.qty}</th>
              <th>{L.unitPrice}<small>({sym})</small></th>
              <th>{L.discount}<small>({sym})</small></th>
              <th>{L.lineTotal}<small>({sym})</small></th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.length ? (
              invoice.items.map((it, i) => (
                <tr key={i}>
                  <td className="idx mpi-num">{i + 1}</td>
                  <td className="item">
                    {it.name}
                    {it.note ? <span className="note">{it.note}</span> : null}
                  </td>
                  <td className="code mpi-num">{it.sku || '—'}</td>
                  <td className="mpi-num">{it.qty}</td>
                  <td className="mpi-num">{n(it.unitPrice)}</td>
                  <td className="mpi-num">{n(it.discount)}</td>
                  <td className="total mpi-num">{n(totals.lineTotals[i] ?? 0)}</td>
                </tr>
              ))
            ) : (
              <tr className="mpi-empty"><td colSpan={7}>—</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mpi-sum">
        <div className="mpi-card mpi-pay">
          <div className="mpi-rows">
            <div className="mpi-row"><span className="lbl strong"><Wallet size={ic(17)} /> {L.paid}</span><span className="val mpi-num">{m(totals.paid)}</span></div>
            {totals.change > 0 ? (
              <div className="mpi-row"><span className="lbl strong"><HandCoins size={ic(17)} /> {L.change}</span><span className="val mpi-num">{m(totals.change)}</span></div>
            ) : (
              <div className="mpi-row"><span className="lbl strong"><HandCoins size={ic(17)} /> {L.remaining}</span><span className="val mpi-num">{m(totals.remaining)}</span></div>
            )}
            <div className="mpi-row"><span className="lbl strong"><CreditCard size={ic(17)} /> {L.paymentMethod}</span><span className="val small">{invoice.paymentMethod}</span></div>
          </div>
        </div>
        <div className="mpi-card">
          <div className="mpi-totals">
            <div className="mpi-trow"><span>{L.subtotal}</span><span className="val mpi-num">{m(totals.subtotal)}</span></div>
            <div className={totals.invoiceDiscount > 0 ? 'mpi-trow disc' : 'mpi-trow'}><span>{L.invoiceDiscount}</span><span className="val mpi-num">{totals.invoiceDiscount > 0 ? '-' : ''}{m(totals.invoiceDiscount)}</span></div>
            {invoice.taxRate > 0 ? (
              <div className="mpi-trow"><span>{L.tax} (<span className="mpi-num">{taxPct}%</span>)</span><span className="val mpi-num">{m(totals.tax)}</span></div>
            ) : null}
            <div className="mpi-grand"><span className="lbl"><Coins size={ic(20)} /> {L.grandTotal}</span><span className="val mpi-num">{m(totals.grandTotal)}</span></div>
          </div>
        </div>
      </section>

      <div className="mpi-bottom">
        <section className="mpi-footer">
          <div className="mpi-warranty">
            <h4><ShieldCheck size={ic(18)} /> {L.warrantyTitle}</h4>
            <ul>
              {store.warrantyNotes.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
          <div className="mpi-codes">
            {invoice.showBarcode !== false ? (
              <>
                <Barcode value={invoice.number} height={sz(44)} barWidth={sz(1.25)} showText={false} />
                <div className="bc-no mpi-num">{invoice.number}</div>
              </>
            ) : null}
          </div>
          <div className="mpi-codes">
            {invoice.qrUrl ? (
              <>
                <QrCode value={invoice.qrUrl} size={ic(72)} />
                <div className="cap">{L.scanQr}</div>
              </>
            ) : null}
          </div>
        </section>

        <section className="mpi-sign">
          <div className="mpi-sign-box">
            <h5>{L.customerSignature}</h5>
            <div className="mpi-sign-area" />
            <div className="mpi-sign-line"><span>{L.name}:</span><span className="dots" /></div>
            <div className="mpi-sign-line"><span>{L.date}:</span><span className="dots mpi-num">{when.date}</span></div>
          </div>
          {invoice.stamped === false ? <div /> : (
            <div className="mpi-stamp" aria-hidden>
              <div style={{ width: `${sz(9)}mm`, height: `${sz(6)}mm`, color: ACCENT }}><Moto /></div>
              <div className="s-name">{store.name}</div>
              <div className="s-sub">{store.subtitle}</div>
              <div className="s-addr">{store.address}</div>
              <div className="s-star">★</div>
            </div>
          )}
          <div className="mpi-sign-box">
            <h5>{L.reviewerSignature}</h5>
            <div className="mpi-sign-area">{invoice.reviewed ? <span className="mpi-reviewed">{L.reviewed}</span> : null}</div>
            <div className="mpi-sign-line"><span>{L.name}:</span><span className="dots" /></div>
            <div className="mpi-sign-line"><span>{L.date}:</span><span className="dots mpi-num">{when.date}</span></div>
          </div>
        </section>

        <footer className="mpi-bar">
          <span className="grp"><MapPin size={ic(14)} /> {store.address}</span>
          <span className="thanks">{store.thanks}</span>
          <span className="grp mpi-num"><Phone size={ic(13)} /> {store.phones.join('  |  ')}</span>
        </footer>
      </div>
    </div>
  );
});
