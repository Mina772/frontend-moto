import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormGrid, SelectField, TextAreaField, TextField } from '@/components/shared/form';
import { customerService } from '@/services';
import { useLookups } from '@/hooks/useLookups';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/i18n';
import type { Customer } from '@/types';

export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; customer?: Customer | null; onSaved?: (c: Customer) => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const { options } = useLookups();
  const branchId = useAuthStore((s) => s.session!.user.branchId);
  const schema = z.object({
    nameAr: z.string().min(2, t('validation.minLength', { n: 2 })),
    nameEn: z.string().optional(),
    phone: z.string().regex(/^01[0125]\d{8}$/, t('validation.phone')).or(z.literal('')),
    whatsapp: z.string().optional(),
    type: z.enum(['retail', 'wholesale', 'workshop']),
    creditLimit: z.coerce.number().min(0, t('validation.nonNegative')),
    branchId: z.string().min(1, t('validation.required')),
    addressAr: z.string().optional(),
    addressEn: z.string().optional(),
    notes: z.string().optional(),
  });
  type F = z.infer<typeof schema>;
  const form = useForm<F>({ resolver: zodResolver(schema), defaultValues: { nameAr: '', nameEn: '', phone: '', whatsapp: '', type: 'retail', creditLimit: 0, branchId, addressAr: '', addressEn: '', notes: '' } });

  React.useEffect(() => {
    if (open) form.reset(customer ? { nameAr: customer.name.ar, nameEn: customer.name.en, phone: customer.phone, whatsapp: customer.whatsapp, type: customer.type, creditLimit: customer.creditLimit, branchId: customer.branchId, addressAr: customer.address.ar, addressEn: customer.address.en, notes: customer.notes ?? '' } : { nameAr: '', nameEn: '', phone: '', whatsapp: '', type: 'retail', creditLimit: 0, branchId, addressAr: '', addressEn: '', notes: '' });
  }, [open, customer, branchId, form]);

  const submit = form.handleSubmit(async (v) => {
    const saved = await customerService.save({ id: customer?.id, name: { ar: v.nameAr, en: v.nameEn }, phone: v.phone, whatsapp: v.whatsapp || v.phone, type: v.type, creditLimit: v.creditLimit, branchId: v.branchId, address: { ar: v.addressAr ?? '', en: v.addressEn ?? '' }, notes: v.notes, isActive: customer?.isActive ?? true });
    toast.success(customer ? t('common.updated') : t('common.created'));
    qc.invalidateQueries({ queryKey: ['customers'] });
    onSaved?.(saved);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{customer ? t('common.edit') : t('customers.addCustomer')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <FormGrid>
            <TextField control={form.control} name="nameAr" label={t('common.nameAr')} required />
            <TextField control={form.control} name="nameEn" label={t('common.nameEn')} dir="ltr" />
            <TextField control={form.control} name="phone" label={t('common.phone')} dir="ltr" placeholder="01xxxxxxxxx" />
            <TextField control={form.control} name="whatsapp" label={t('customers.whatsapp')} dir="ltr" hint={t('common.optional')} />
            <SelectField control={form.control} name="type" label={t('common.type')} options={(['retail', 'wholesale', 'workshop'] as const).map((k) => ({ value: k, label: t(`customers.types.${k}`) }))} />
            <TextField control={form.control} name="creditLimit" type="number" label={t('customers.creditLimit')} dir="ltr" />
            <SelectField control={form.control} name="branchId" label={t('common.branch')} options={options.activeBranches} required />
            <TextField control={form.control} name="addressAr" label={`${t('common.address')} (AR)`} />
            <TextField control={form.control} name="addressEn" label={`${t('common.address')} (EN)`} dir="ltr" />
          </FormGrid>
          <TextAreaField control={form.control} name="notes" label={t('common.notes')} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={form.formState.isSubmitting}>{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
