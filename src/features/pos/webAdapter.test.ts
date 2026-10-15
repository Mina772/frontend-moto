import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultPrintProfiles } from '@moto/shared';
import type { PaperKind } from '@moto/shared';
import { createWebPosAdapter } from './webAdapter';

vi.mock('@/services', () => ({ api: {}, devicePrintPref: {} }));

afterEach(() => vi.restoreAllMocks());

describe('browser invoice paper dimensions', () => {
  it.each([
    ['thermal80', '@page { size: 80mm 304mm; margin: 0; }'],
    ['a4', '@page { size: 210mm 297mm; margin: 0; }'],
  ] as const)('prints %s with its exact page dimensions', async (paper: PaperKind, expectedPage) => {
    const adapter = createWebPosAdapter({ user: {} as Parameters<typeof createWebPosAdapter>[0]['user'], permissions: [], branchId: 'br1', locale: 'ar', navigate: () => undefined, branchName: () => '' });
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ height: 300 * 96 / 25.4 } as DOMRect);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(document.body.lastElementChild?.textContent).toContain(expectedPage);
    });
    const profile = defaultPrintProfiles().find((p) => p.paper === paper)!;
    await adapter.print(element, profile);
    expect(print).toHaveBeenCalledOnce();
    expect(document.body.querySelector('style')).toBeNull();
  });

  it('removes the temporary page size when printing fails', async () => {
    const adapter = createWebPosAdapter({ user: {} as Parameters<typeof createWebPosAdapter>[0]['user'], permissions: [], branchId: 'br1', locale: 'ar', navigate: () => undefined, branchName: () => '' });
    vi.spyOn(window, 'print').mockImplementation(() => { throw new Error('Print failed'); });
    await expect(adapter.print(document.createElement('div'), defaultPrintProfiles()[0])).rejects.toThrow('Print failed');
    expect(document.body.querySelector('style')).toBeNull();
  });
});
