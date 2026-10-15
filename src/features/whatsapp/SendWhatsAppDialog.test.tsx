import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_SETTINGS } from '@moto/shared';
import type { Customer } from '@/types';
import { toast } from 'sonner';
import { SendWhatsAppDialog } from './SendWhatsAppDialog';

const mocks = vi.hoisted(() => ({ send: vi.fn(), stats: vi.fn() }));
vi.mock('@/services', () => ({
  whatsappService: { send: mocks.send, stats: mocks.stats, templates: async () => [{ key: 'statement', name: { ar: 'Statement' }, body: { ar: 'Hello {customer}' }, isActive: true }] },
  customerService: { debts: async () => ({ data: [] }) },
}));
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ settings: DEFAULT_SETTINGS }) }));
vi.mock('@/hooks/useLookups', () => ({ useLookups: () => ({ options: { customers: [] }, customers: [] }) }));
vi.mock('@/stores/authStore', () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ session: { user: { id: 'u1' } } }) }));
vi.mock('@/i18n', () => ({ useT: () => ({ t: (key: string) => key, tx: (value: { ar: string }) => value?.ar ?? '', locale: 'en' }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const customer = { id: 'c1', name: { ar: 'Customer' }, whatsapp: '201000000000', balance: 0 } as Customer;
beforeEach(() => { vi.clearAllMocks(); mocks.stats.mockResolvedValue({ mode: 'web' }); });
afterEach(cleanup);
async function mount() {
  const close = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SendWhatsAppDialog open onOpenChange={close} customer={customer} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'whatsapp.openWhatsapp' })).toBeEnabled());
  return close;
}
describe('WhatsApp send outcomes', () => {
  it('keeps a failed message open and reports its error', async () => {
    mocks.send.mockResolvedValue({ status: 'failed', error: 'Provider unavailable' });
    const close = await mount();
    fireEvent.click(screen.getByRole('button', { name: 'whatsapp.openWhatsapp' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Provider unavailable'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
  it('reports preparation and opens the manual link without claiming delivery', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    mocks.send.mockResolvedValue({ status: 'prepared', link: 'https://wa.me/201000000000' });
    const close = await mount();
    fireEvent.click(screen.getByRole('button', { name: 'whatsapp.openWhatsapp' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('whatsapp.messagePrepared'));
    expect(open).toHaveBeenCalledWith('https://wa.me/201000000000', '_blank', 'noopener');
    expect(close).toHaveBeenCalledWith(false);
    open.mockRestore();
  });
});
