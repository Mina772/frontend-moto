import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { InvoiceDocument, PosLocaleContext, pageStyleFor } from '@moto/pos-core';
import { defaultPrintProfiles } from '@moto/shared';
import type { PrintProfile, Sale } from '@/types';
import { devicePrintPref, settingsService } from '@/services';
import { useLookups } from '@/hooks/useLookups';
import { useSettings } from '@/hooks/useSettings';
import { useUiStore } from '@/stores/uiStore';

const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || (typeof window !== 'undefined' ? window.location.origin : '');

/** Renders a sale with the device/default print profile (or an explicit one). Wrap in `.print-area` to print. */
export const Receipt = React.forwardRef<HTMLDivElement, { sale: Sale; profile?: PrintProfile | null; profileId?: string | null }>(function Receipt({ sale, profile, profileId }, ref) {
  const locale = useUiStore((s) => s.locale);
  const { settings } = useSettings();
  const { branches, users, customers, products, models } = useLookups();
  const profilesQ = useQuery({ queryKey: ['printProfiles', sale.branchId], queryFn: () => settingsService.printProfiles(sale.branchId), staleTime: 300_000 });
  const list = profilesQ.data ?? defaultPrintProfiles();
  const chosen = profile ?? list.find((x) => x.id === (profileId ?? devicePrintPref.get())) ?? list.find((x) => x.isDefault) ?? list[0]!;
  return (
    <PosLocaleContext.Provider value={locale}>
      <style>{pageStyleFor(chosen)}</style>
      <InvoiceDocument
        ref={ref}
        sale={sale}
        profile={chosen}
        settings={settings}
        branch={branches.find((b) => b.id === sale.branchId) ?? null}
        cashier={users.find((u) => u.id === sale.cashierId) ?? null}
        customer={customers.find((c) => c.id === sale.customerId) ?? null}
        products={Object.fromEntries(products.map((p) => [p.id, p]))}
        models={Object.fromEntries(models.map((m) => [m.id, m]))}
        verifyBaseUrl={PUBLIC_URL}
      />
    </PosLocaleContext.Provider>
  );
});
