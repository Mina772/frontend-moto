import type {
  AlternativeSuggestion, AppSettings, Brand, CashMovementType, Category, Customer, ID, Locale, MotorcycleModel, PaymentMethod, Permission, PrintProfile, Product, QuickCategory, QuickProduct, RegisterSession, Sale, SaleReturn, SpecialPrice, User,
} from '@moto/shared';
import type { SaleCreateInput, CustomerSaveInput, QuickProductSaveInput, SaleReturnCreateInput } from '@moto/shared';
import type { PrintOutcome } from '@moto/shared';

export interface PosProduct extends Product {
  /** Quantity available at the current branch. */
  available: number;
  /** "rack · shelf · bin" in this branch, shown so the cashier can fetch the part. */
  location?: string;
}

export interface CatalogMeta {
  categories: Category[];
  brands: Brand[];
  models: MotorcycleModel[];
}

export interface ConnectivityState {
  online: boolean;
  syncing: boolean;
  /** Server no longer knows this terminal; pushes are paused until it is registered again. */
  unregistered?: boolean;
  pending: number;
  rejected: number;
  lastSyncAt: string | null;
  error?: string | null;
}

/**
 * Everything the POS terminal UI needs from its host. The web app implements it over the REST API;
 * the desktop app implements it over IPC → SQLite with an outbox.
 */
export interface PosAdapter {
  /** Current user, permissions and branch. */
  readonly user: User;
  readonly permissions: Permission[];
  readonly branchId: ID;
  readonly terminalCode?: string;

  settings(): Promise<AppSettings>;
  lookup(term: string): Promise<{ products: PosProduct[]; legacyHit: boolean }>;
  product(id: ID): Promise<PosProduct | null>;
  customers(): Promise<Customer[]>;
  createCustomer(input: CustomerSaveInput): Promise<Customer>;
  specialPrices(): Promise<SpecialPrice[]>;
  quickGrid(): Promise<{ products: QuickProduct[]; categories: QuickCategory[]; catalog: PosProduct[] }>;
  /** Lookup lists used by the product filter (categories, brands, motorcycle models). */
  catalogMeta?(): Promise<CatalogMeta>;
  saveQuickProduct(input: QuickProductSaveInput): Promise<QuickProduct>;
  deleteQuickProduct(id: ID): Promise<void>;
  reorderQuick(ids: ID[]): Promise<void>;
  currentSession(): Promise<RegisterSession | null>;
  /** Persists the sale (locally first on desktop). Returns the sale with its invoice number. */
  createSale(input: SaleCreateInput): Promise<Sale>;
  lastSale(id: ID): Promise<Sale | null>;
  /** Invoice lookup for the returns flow; desktop reads the terminal's own cache. */
  saleByInvoice?(invoiceNumber: string): Promise<Sale | null>;
  recentSales?(limit?: number): Promise<Sale[]>;
  createSaleReturn?(input: SaleReturnCreateInput): Promise<SaleReturn>;
  /** Cash in / out / expense against the open drawer. */
  cashMovement?(input: { type: CashMovementType; amount: number; notes?: string }): Promise<RegisterSession>;
  collectDebt?(input: { customerId: ID; amount: number; method: PaymentMethod; notes?: string }): Promise<unknown>;
  /** Branch id → display name, for stock held in other branches. */
  branchName?(id: ID): string;
  alternatives(productId: ID): Promise<AlternativeSuggestion[]>;
  printProfiles(): Promise<PrintProfile[]>;
  getDevicePrintProfile(): string | null;
  setDevicePrintProfile(id: string | null): void;
  /** Platform print: web → window.print(); desktop → Windows printer dialog. */
  print(target: HTMLElement | null, profile: PrintProfile | null): Promise<void | PrintOutcome>;
  invoiceProfile?(size: 'small' | 'large'): Promise<PrintProfile>;
  openDrawer?(): Promise<void>;
  openCustomerDisplay?(): Promise<void>;
  requestTransfer?(productId: ID, fromBranchId: ID, qty: number): Promise<void>;
  navigate(path: string): void;
  connectivity(): ConnectivityState;
  subscribeConnectivity(fn: (s: ConnectivityState) => void): () => void;
  syncNow?(): Promise<void>;
  locale: Locale;
  /** Host-specific message when the browser cannot save completed sales offline. */
  offlineNotice?: string;
}
