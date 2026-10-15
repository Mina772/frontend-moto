import * as React from 'react';
import type { AppSettings, PriceTier } from '@moto/shared';
import { Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from '@moto/ui';
import { FilterX, MapPin, Search } from 'lucide-react';
import type { CatalogMeta, PosProduct } from '../adapter';
import { EMPTY_FILTERS, filterCatalog, hasActiveFilters, stockStateOf, type CatalogFilters, type CatalogSort, type StockFilter } from '../catalogFilter';
import { formatMoney, usePosT } from '../i18n';

export interface ProductFilterPanelProps {
  catalog: PosProduct[];
  meta?: CatalogMeta | null;
  settings: AppSettings;
  tier: PriceTier;
  allowNegative: boolean;
  onPick: (p: PosProduct) => void;
  /** Focus the search box when this value changes (e.g. on F5). */
  focusKey?: number;
}

const PAGE = 60;
const ALL = '__all';

/** Browse the whole local catalog with category / brand / fitment / stock filters (works offline). */
export function ProductFilterPanel({ catalog, meta, settings, tier, allowNegative, onPick, focusKey }: ProductFilterPanelProps) {
  const { p, tx, locale } = usePosT();
  const f = p.filter;
  const [filters, setFilters] = React.useState<CatalogFilters>(EMPTY_FILTERS);
  const [limit, setLimit] = React.useState(PAGE);
  const [active, setActive] = React.useState(0);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const deferredTerm = React.useDeferredValue(filters.term);
  const results = React.useMemo(
    () => filterCatalog(catalog, { ...filters, term: deferredTerm }, { categories: meta?.categories, tier, locale }),
    [catalog, filters, deferredTerm, meta?.categories, tier, locale],
  );
  const shown = results.slice(0, limit);
  React.useEffect(() => {
    setLimit(PAGE);
    setActive(0);
  }, [filters, deferredTerm]);
  React.useEffect(() => {
    if (focusKey) searchRef.current?.focus();
  }, [focusKey]);
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const set = <K extends keyof CatalogFilters>(k: K, v: CatalogFilters[K]) => setFilters((s) => ({ ...s, [k]: v }));
  const pickable = (prod: PosProduct) => prod.available > 0 || allowNegative;
  const brandName = React.useMemo(() => new Map((meta?.brands ?? []).map((b) => [b.id, tx(b.name)])), [meta?.brands, tx]);
  const categories = React.useMemo(() => [...(meta?.categories ?? [])].sort((a, b) => tx(a.name).localeCompare(tx(b.name))), [meta?.categories, tx]);
  const brands = React.useMemo(() => [...(meta?.brands ?? [])].sort((a, b) => tx(a.name).localeCompare(tx(b.name))), [meta?.brands, tx]);
  const models = React.useMemo(() => [...(meta?.models ?? [])].sort((a, b) => a.code.localeCompare(b.code)), [meta?.models]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const prod = shown[active];
      if (prod && pickable(prod)) onPick(prod);
    } else if (e.key === 'Escape' && filters.term) {
      e.stopPropagation();
      set('term', '');
    }
  };

  const picker = (value: string | null, onChange: (v: string | null) => void, label: string, options: { value: string; label: string }[]) => (
    <Select value={value ?? ALL} onValueChange={(v) => v && onChange(v === ALL ? null : v)}>
      <SelectTrigger size="sm" className={cn('h-8 w-auto min-w-28 max-w-48 text-xs', value && 'border-primary text-primary')} aria-label={label}>
        <span className="me-1 text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={ALL}>{f.all}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const stockChips: { v: StockFilter; label: string }[] = [
    { v: 'all', label: f.all },
    { v: 'in', label: f.inStock },
    { v: 'low', label: f.low },
    { v: 'out', label: f.out },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 px-3 pt-2">
        <div className="flex items-center gap-2">
          <Input
            ref={searchRef}
            value={filters.term}
            onChange={(e) => set('term', e.target.value)}
            onKeyDown={onKey}
            placeholder={f.search}
            className="h-9"
            startIcon={<Search />}
            autoComplete="off"
            aria-label={f.search}
          />
          <span className="shrink-0 text-xs text-muted-foreground"><span className="num font-semibold text-foreground">{results.length}</span> {f.results}</span>
          <Button size="sm" variant="ghost" disabled={!hasActiveFilters(filters)} onClick={() => setFilters((s) => ({ ...EMPTY_FILTERS, sort: s.sort }))}>
            <FilterX /> {f.reset}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.length ? picker(filters.categoryId, (v) => set('categoryId', v), f.category, categories.map((c) => ({ value: c.id, label: tx(c.name) }))) : null}
          {brands.length ? picker(filters.brandId, (v) => set('brandId', v), f.brand, brands.map((b) => ({ value: b.id, label: tx(b.name) }))) : null}
          {models.length ? picker(filters.modelId, (v) => set('modelId', v), f.model, models.map((mo) => ({ value: mo.id, label: `${mo.code} — ${tx(mo.name)}` }))) : null}
          <div className="flex items-center rounded-md border p-0.5" role="radiogroup" aria-label={f.stock}>
            {stockChips.map((c) => (
              <button
                key={c.v}
                type="button"
                role="radio"
                aria-checked={filters.stock === c.v}
                onClick={() => set('stock', c.v)}
                className={cn('rounded px-2 py-0.5 text-xs', filters.stock === c.v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
              >
                {c.label}
              </button>
            ))}
          </div>
          <Select value={filters.sort} onValueChange={(v) => v && set('sort', v as CatalogSort)}>
            <SelectTrigger size="sm" className="ms-auto h-8 w-auto min-w-32 text-xs" aria-label={f.sort}>
              <span className="me-1 text-muted-foreground">{f.sort}:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">{f.sortName}</SelectItem>
              <SelectItem value="priceAsc">{f.sortPriceAsc}</SelectItem>
              <SelectItem value="priceDesc">{f.sortPriceDesc}</SelectItem>
              <SelectItem value="stock">{f.sortStock}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={listRef} className="mt-2 min-h-0 flex-1 overflow-y-auto border-t">
        {shown.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{f.empty}</div>
        ) : (
          shown.map((prod, i) => {
            const st = stockStateOf(prod);
            return (
              <button
                key={prod.id}
                type="button"
                data-idx={i}
                disabled={!pickable(prod)}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPick(prod)}
                className={cn('flex w-full items-center gap-3 border-b px-3 py-2 text-start disabled:opacity-50', i === active && 'bg-accent')}
              >
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-medium">{tx(prod.name)}</div>
                  <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{p.sku}: <bdi className="num">{prod.sku}</bdi></span>
                    <span>{p.barcode}: <bdi className="num">{prod.internalBarcode}</bdi></span>
                    <span>{p.receipt.partNumber}: <bdi className="num">{prod.partNumber}</bdi></span>
                    {brandName.get(prod.brandId) ? <> · {brandName.get(prod.brandId)}</> : null}
                    {prod.size ? <> · <span className="num">{prod.size}</span></> : null}
                    {prod.location ? <span className="ms-1 inline-flex items-center gap-0.5 font-medium text-primary"><MapPin className="size-2.5" /> {prod.location}</span> : null}
                  </div>
                </div>
                <Badge variant={st === 'out' ? 'destructive' : st === 'low' ? 'warning' : 'success'}>{p.stock}: <span className="num">{prod.available}</span></Badge>
                <span className="w-24 text-end text-sm font-semibold num">{formatMoney(prod.prices[tier], locale, settings.currency.symbol, 0)}</span>
              </button>
            );
          })
        )}
        {results.length > shown.length ? (
          <div className="p-2 text-center">
            <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
              {f.showMore} (<span className="num">{results.length - shown.length}</span>)
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
