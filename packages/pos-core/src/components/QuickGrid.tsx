import * as React from 'react';
import type { AppSettings, PriceTier, QuickCategory, QuickProduct } from '@moto/shared';
import type { QuickProductSaveInput } from '@moto/shared';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, cn } from '@moto/ui';
import { ChevronLeft, ChevronRight, GripVertical, MapPin, Maximize2, Minimize2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { PosProduct } from '../adapter';
import { formatMoney, usePosT } from '../i18n';

export interface QuickGridProps {
  quick: QuickProduct[];
  categories: QuickCategory[];
  catalog: PosProduct[];
  settings: AppSettings;
  tier: PriceTier;
  canEdit: boolean;
  allowNegative: boolean;
  /** Bigger touch tiles and a wider grid when the panel takes over the screen. */
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onPick: (p: PosProduct) => void;
  onSave: (input: QuickProductSaveInput) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onReorder: (ids: string[]) => Promise<unknown>;
  lookup: (term: string) => Promise<PosProduct[]>;
}

/** Category-tabbed, paginated, drag-reorderable quick product grid with an in-place edit mode. */
export function QuickGrid({ quick, categories, catalog, settings, tier, canEdit, allowNegative, fullscreen, onToggleFullscreen, onPick, onSave, onDelete, onReorder, lookup }: QuickGridProps) {
  const { p, tx, locale } = usePosT();
  const [cat, setCat] = React.useState<string | 'all'>('all');
  const [page, setPage] = React.useState(0);
  const [editing, setEditing] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [term, setTerm] = React.useState('');
  const [filter, setFilter] = React.useState('');
  const [results, setResults] = React.useState<PosProduct[]>([]);
  const dragId = React.useRef<string | null>(null);
  const cols = fullscreen ? Math.min(10, Math.max(5, (settings.pos.gridColumns || 6) + 2)) : Math.min(8, Math.max(4, settings.pos.gridColumns || 6));
  const pageSize = Math.max(cols * (fullscreen ? 4 : 2), settings.pos.gridPageSize || 24);
  const byId = React.useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  const visible = React.useMemo(() => {
    const term_ = filter.trim().toLowerCase();
    return quick
      .filter((q) => cat === 'all' || q.categoryId === cat)
      .filter((q) => {
        if (!term_) return true;
        const prod = byId.get(q.productId);
        const label = q.label ? `${q.label.ar} ${q.label.en ?? ''}` : '';
        return `${label} ${prod ? `${prod.name.ar} ${prod.name.en ?? ''} ${prod.sku} ${prod.partNumber} ${prod.internalBarcode}` : ''}`.toLowerCase().includes(term_);
      })
      .sort((a, b) => a.order - b.order);
  }, [quick, cat, filter, byId]);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const slice = visible.slice(page * pageSize, (page + 1) * pageSize);
  React.useEffect(() => setPage(0), [cat, filter]);

  React.useEffect(() => {
    if (!addOpen) return;
    const h = setTimeout(() => {
      if (term.trim()) lookup(term).then(setResults).catch(() => setResults([]));
      else setResults([]);
    }, 150);
    return () => clearTimeout(h);
  }, [term, addOpen, lookup]);

  const drop = async (targetId: string) => {
    const src = dragId.current;
    dragId.current = null;
    if (!src || src === targetId) return;
    const ids = visible.map((q) => q.id);
    const from = ids.indexOf(src);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ...ids.splice(from, 1));
    await onReorder(ids);
  };

  // auto-fill rather than a fixed column count, so a wider screen simply shows more tiles.
  const minTile = fullscreen ? 13 : 11;
  const gridStyle: React.CSSProperties = { gridTemplateColumns: `repeat(auto-fill, minmax(min(${minTile}rem, 100%), 1fr))`, maxWidth: fullscreen ? undefined : `${cols * (minTile + 3)}rem` };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-3 pt-2">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={p.searchQuick} className={cn('h-7 text-xs', fullscreen ? 'w-72' : 'w-44')} aria-label={p.searchQuick} />
        {onToggleFullscreen ? (
          <Button size="icon-xs" variant="ghost" onClick={onToggleFullscreen} aria-label={fullscreen ? p.exitFullscreen : p.fullscreen} title={fullscreen ? p.exitFullscreen : p.fullscreen}>
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-1 overflow-x-auto px-3 pt-2">
        <Button size="xs" variant={cat === 'all' ? 'secondary' : 'ghost'} onClick={() => setCat('all')}>{p.allCategories}</Button>
        {[...categories].sort((a, b) => a.order - b.order).map((c) => (
          <Button key={c.id} size="xs" variant={cat === c.id ? 'secondary' : 'ghost'} onClick={() => setCat(c.id)} style={c.color ? { borderBottom: `2px solid ${c.color}` } : undefined}>
            {tx(c.name)}
          </Button>
        ))}
        <span className="ms-auto flex items-center gap-1">
          {pages > 1 ? (
            <>
              <Button size="icon-xs" variant="ghost" disabled={page === 0} onClick={() => setPage((x) => x - 1)}><ChevronRight className="rtl:hidden" /><ChevronLeft className="ltr:hidden" /></Button>
              <span className="num text-[11px] text-muted-foreground">{page + 1}/{pages}</span>
              <Button size="icon-xs" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((x) => x + 1)}><ChevronLeft className="rtl:hidden" /><ChevronRight className="ltr:hidden" /></Button>
            </>
          ) : null}
          {canEdit ? (
            <Button size="xs" variant={editing ? 'default' : 'ghost'} onClick={() => setEditing((e) => !e)}>
              <Pencil /> {editing ? p.doneEditing : p.editGrid}
            </Button>
          ) : null}
        </span>
      </div>
      <div className="grid flex-1 content-start gap-2 overflow-y-auto p-3" style={gridStyle} onContextMenu={(e) => { if (canEdit) { e.preventDefault(); setEditing(true); } }}>
        {slice.map((q) => {
          const prod = byId.get(q.productId);
          if (!prod) return null;
          const st = prod.available;
          const price = prod.prices[tier];
          return (
            <div
              key={q.id}
              draggable={editing}
              onDragStart={() => (dragId.current = q.id)}
              onDragOver={(e) => editing && e.preventDefault()}
              onDrop={() => void drop(q.id)}
              className="relative"
            >
              <button
                type="button"
                disabled={!editing && st <= 0 && !allowNegative}
                onClick={() => !editing && onPick(prod)}
                className={cn('flex w-full flex-col gap-2 rounded-md border bg-card p-2 text-start transition-colors hover:border-primary hover:bg-accent/40 disabled:opacity-50', fullscreen ? 'min-h-40' : 'min-h-36', editing && 'cursor-grab border-dashed')}
                style={q.color ? { borderTopColor: q.color, borderTopWidth: 3 } : undefined}
              >
                <span className="flex min-h-0 flex-1 items-start gap-1.5">
                  {prod.image ? <img src={prod.image} alt="" className={cn('shrink-0 rounded object-cover', fullscreen ? 'size-12' : 'size-7')} draggable={false} /> : null}
                  <span className={cn('break-words font-medium leading-tight', fullscreen ? 'text-base' : 'text-sm')}>{q.label ? tx(q.label) : tx(prod.name)}</span>
                </span>
                <span className="flex flex-col gap-0.5 break-words text-xs text-muted-foreground">
                  {q.label ? <span>{tx(prod.name)}</span> : null}
                  <span>{p.sku}: <bdi className="num">{prod.sku}</bdi></span>
                  <span>{p.barcode}: <bdi className="num">{prod.internalBarcode}</bdi></span>
                  {prod.partNumber ? <span>{p.receipt.partNumber}: <bdi className="num">{prod.partNumber}</bdi></span> : null}
                  {prod.size ? <span>{p.productSize}: <bdi className="num">{prod.size}</bdi></span> : null}
                  {prod.location ? <span className="inline-flex items-center gap-1 text-primary"><MapPin className="size-3 shrink-0" /> {prod.location}</span> : null}
                </span>
                <span className={cn('flex items-center justify-between', fullscreen ? 'text-sm' : 'text-[11px]')}>
                  <span className={cn('num', st === 0 ? 'text-destructive' : st < prod.minStock ? 'text-amber-600' : 'text-muted-foreground')}>{st} {p.piece}</span>
                  <span className="font-semibold num">{formatMoney(price, locale, settings.currency.symbol, 0)}</span>
                </span>
              </button>
              {editing ? (
                <>
                  <GripVertical className="absolute start-0.5 top-0.5 size-3.5 text-muted-foreground" />
                  <button type="button" className="absolute end-0.5 top-0.5 rounded bg-destructive/90 p-0.5 text-white" onClick={() => void onDelete(q.id)} aria-label={p.removeFromGrid}>
                    <Trash2 className="size-3" />
                  </button>
                </>
              ) : null}
            </div>
          );
        })}
        {editing ? (
          <button type="button" onClick={() => setAddOpen(true)} className={cn('flex flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-foreground', fullscreen ? 'h-28' : 'h-20')}>
            <Plus /> {p.addToGrid}
          </button>
        ) : null}
        {!slice.length ? <div className="col-span-full py-10 text-center text-xs text-muted-foreground">{filter ? p.productNotFound : p.noQuickProducts}</div> : null}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{p.addToGrid}</DialogTitle></DialogHeader>
          <Input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder={p.search} />
          <div className="max-h-72 overflow-y-auto rounded-md border">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="flex w-full items-center justify-between border-b px-3 py-2 text-start text-sm last:border-0 hover:bg-accent"
                onClick={async () => {
                  await onSave({ productId: r.id, categoryId: cat === 'all' ? null : cat, branchId: null, order: quick.length + 1 });
                  setAddOpen(false);
                  setTerm('');
                }}
              >
                <span className="truncate">{tx(r.name)}</span>
                <span className="num text-xs text-muted-foreground">{r.sku}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
