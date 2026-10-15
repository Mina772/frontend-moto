import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_SETTINGS } from '@moto/shared';
import { PosLocaleContext } from '../i18n';
import { PaymentDialog } from './PaymentDialog';
afterEach(cleanup);
function show(type: 'cash' | 'credit' = 'cash') {
  const onConfirm = vi.fn();
  render(<PosLocaleContext.Provider value="en"><PaymentDialog open onOpenChange={() => undefined} total={100} saleType={type} customer={null} settings={{ ...DEFAULT_SETTINGS, pos: { ...DEFAULT_SETTINGS.pos, requireCustomerForCredit: false } }} onConfirm={onConfirm} /></PosLocaleContext.Provider>);
  return onConfirm;
}
it('blocks card overpayment and keeps valid cash change available', () => {
  const confirm = show();
  fireEvent.click(screen.getByRole('button', { name: /^Card$/i }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } });
  fireEvent.click(screen.getByRole('button', { name: /complete|confirm/i }));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^Cash$/i }));
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } });
  fireEvent.click(screen.getByRole('button', { name: /complete|confirm/i }));
  expect(confirm).toHaveBeenCalledTimes(1);
});
it('requires a customer for credit as the API and offline storage do', () => {
  const confirm = show('credit');
  fireEvent.click(screen.getByRole('button', { name: /complete|confirm/i }));
  expect(confirm).not.toHaveBeenCalled();
});
