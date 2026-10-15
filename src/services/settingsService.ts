import type { AppSettings, ID, LabelTemplate, PrintProfile, QuickCategory, QuickProduct } from '@/types';
import type { LabelTemplateSaveInput, PrintProfileSaveInput, QuickCategorySaveInput, QuickProductSaveInput } from '@moto/shared';
import { api } from './api';

export const settingsService = {
  get: (): Promise<AppSettings> => api.settings.get(),
  update: <K extends keyof AppSettings>(section: K, value: AppSettings[K], _userId?: ID): Promise<AppSettings> => api.settings.update(section, value),
  uploadLogo: (file: File) => api.settings.uploadLogo(file),

  printProfiles: (branchId?: ID): Promise<PrintProfile[]> => api.settings.printProfiles(branchId),
  savePrintProfile: (input: PrintProfileSaveInput): Promise<PrintProfile> => api.settings.savePrintProfile(input),
  deletePrintProfile: (id: ID) => api.settings.deletePrintProfile(id),

  labelTemplates: (branchId?: ID): Promise<LabelTemplate[]> => api.settings.labelTemplates(branchId),
  saveLabelTemplate: (input: LabelTemplateSaveInput): Promise<LabelTemplate> => api.settings.saveLabelTemplate(input),
  deleteLabelTemplate: (id: ID) => api.settings.deleteLabelTemplate(id),

  quickProducts: (branchId?: ID): Promise<QuickProduct[]> => api.quick.products(branchId),
  quickCategories: (branchId?: ID): Promise<QuickCategory[]> => api.quick.categories(branchId),
  saveQuickProduct: (input: QuickProductSaveInput): Promise<QuickProduct> => api.quick.saveProduct(input),
  deleteQuickProduct: (id: ID) => api.quick.deleteProduct(id),
  reorderQuickProducts: (ids: ID[]) => api.quick.reorder(ids),
  saveQuickCategory: (input: QuickCategorySaveInput): Promise<QuickCategory> => api.quick.saveCategory(input),
  fillQuickCategory: (id: ID, body?: { limit?: number; replace?: boolean }) => api.quick.fillCategory(id, body),
  deleteQuickCategory: (id: ID) => api.quick.deleteCategory(id),

  terminals: (branchId?: ID) => api.sync.terminals(branchId),
};

/** Device-level print preference (which profile this browser prints with). */
const PRINT_PREF_KEY = 'moto-print-profile';
export const devicePrintPref = {
  get: (): string | null => localStorage.getItem(PRINT_PREF_KEY),
  set: (id: string | null) => (id ? localStorage.setItem(PRINT_PREF_KEY, id) : localStorage.removeItem(PRINT_PREF_KEY)),
};

const LABEL_PREF_KEY = 'moto-label-template';
export const deviceLabelPref = {
  get: (): string | null => localStorage.getItem(LABEL_PREF_KEY),
  set: (id: string | null) => (id ? localStorage.setItem(LABEL_PREF_KEY, id) : localStorage.removeItem(LABEL_PREF_KEY)),
};
