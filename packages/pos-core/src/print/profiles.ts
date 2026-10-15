import { defaultPrintProfiles } from '@moto/shared';
import type { PrintProfile } from '@moto/shared';

export type InvoiceSize = 'small' | 'large';

/** A size selects a paper family; valid saved dimensions remain intact. */
export function invoiceProfileForSize(profile: PrintProfile, size: InvoiceSize): PrintProfile {
  const matches = size === 'small' ? profile.paper === 'thermal58' || profile.paper === 'thermal80' : profile.paper === 'a4' || profile.paper === 'a5';
  return matches ? { ...profile } : { ...profile, paper: size === 'small' ? 'thermal80' : 'a4' };
}

/** Keep both receipt sizes available even before a server profile has been configured. */
export function availablePrintProfiles(profiles: PrintProfile[]): PrintProfile[] {
  const defaults = defaultPrintProfiles();
  const list = [...profiles];
  if (!list.some((p) => p.paper === 'thermal58' || p.paper === 'thermal80')) list.push(defaults.find((p) => p.paper === 'thermal80')!);
  if (!list.some((p) => p.paper === 'a4' || p.paper === 'a5')) list.push(defaults.find((p) => p.paper === 'a4')!);
  return list;
}

export function profileForSize(profiles: PrintProfile[], size: InvoiceSize, deviceId: string | null): PrintProfile {
  const matching = availablePrintProfiles(profiles).filter((p) => size === 'small' ? p.paper === 'thermal58' || p.paper === 'thermal80' : p.paper === 'a4' || p.paper === 'a5');
  const profile = matching.find((p) => p.id === deviceId) ?? matching.find((p) => p.isDefault) ?? matching[0]!;
  return invoiceProfileForSize(profile, size);
}
