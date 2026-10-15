import { describe, expect, it } from 'vitest';
import { defaultPrintProfiles } from '@moto/shared';
import { availablePrintProfiles, invoiceProfileForSize, profileForSize } from './profiles';

describe('invoice size selection', () => {
  it('makes thermal and A4 printing available with no server profiles', () => {
    expect(profileForSize([], 'small', null).paper).toBe('thermal80');
    expect(profileForSize([], 'large', null).paper).toBe('a4');
  });

  it('honors the selected 58mm profile and printer for a small invoice', () => {
    const profiles = defaultPrintProfiles();
    profiles.find((p) => p.paper === 'thermal58')!.printerName = 'Receipt printer';
    expect(profileForSize(profiles, 'small', 'pp-thermal58')).toMatchObject({ paper: 'thermal58', printerName: 'Receipt printer' });
    expect(profiles.find((p) => p.id === 'pp-thermal58')!.paper).toBe('thermal58');
  });

  it('honors 58mm when the server only supplies that thermal profile', () => {
    const profiles = defaultPrintProfiles().filter((p) => p.paper === 'thermal58');
    expect(profileForSize(profiles, 'small', null).paper).toBe('thermal58');
  });

  it('preserves valid profiles returned by a device adapter for either size', () => {
    const profiles = defaultPrintProfiles();
    expect(invoiceProfileForSize(profiles.find((p) => p.paper === 'thermal58')!, 'small').paper).toBe('thermal58');
    expect(invoiceProfileForSize(profiles.find((p) => p.paper === 'a5')!, 'large').paper).toBe('a5');
  });

  it('uses A4 for the large button even when a thermal profile is the device default', () => {
    expect(profileForSize(defaultPrintProfiles(), 'large', 'pp-thermal58').paper).toBe('a4');
  });

  it('uses a thermal receipt for the small button even when A4 is the device default', () => {
    expect(profileForSize(defaultPrintProfiles(), 'small', 'pp-a4').paper).toBe('thermal80');
  });

  it('does not change server profiles when supplying a missing size', () => {
    const profiles = defaultPrintProfiles().filter((p) => p.paper === 'a5');
    expect(availablePrintProfiles(profiles)).toHaveLength(2);
    expect(profiles).toHaveLength(1);
  });
});
