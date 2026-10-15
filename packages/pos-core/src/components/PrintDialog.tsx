import * as React from 'react';
import type { PrintProfile } from '@moto/shared';
import { PAPER_SIZES } from '@moto/shared';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, cn } from '@moto/ui';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { usePosT } from '../i18n';
import { InvoiceDocument, pageStyleFor, type PrintContext } from '../print/templates';

export interface PrintDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profiles: PrintProfile[];
  deviceDefaultId: string | null;
  onSetDeviceDefault: (id: string | null) => void;
  context: Omit<PrintContext, 'profile'> | null;
  onPrint: (profile: PrintProfile, el: HTMLElement | null) => Promise<void>;
}

/** Choose a print profile with live preview; optionally save as device default. */
export function PrintDialog({ open, onOpenChange, profiles, deviceDefaultId, onSetDeviceDefault, context, onPrint }: PrintDialogProps) {
  const { p } = usePosT();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [asDefault, setAsDefault] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (open) setSelected(deviceDefaultId ?? profiles.find((x) => x.isDefault)?.id ?? profiles[0]?.id ?? null);
  }, [open, deviceDefaultId, profiles]);
  const profile = profiles.find((x) => x.id === selected) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3"><DialogTitle>{p.print}</DialogTitle></DialogHeader>
        <div className="grid max-h-[75vh] grid-cols-[260px_1fr] overflow-hidden">
          <div className="space-y-1 overflow-y-auto border-e p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">{p.printProfile}</div>
            {profiles.map((x) => (
              <button key={x.id} type="button" onClick={() => setSelected(x.id)} className={cn('flex w-full flex-col rounded-md border px-3 py-2 text-start text-sm', selected === x.id ? 'border-primary bg-primary/5' : 'hover:bg-accent')}>
                <span className="font-medium">{x.name}</span>
                <span className="text-[11px] text-muted-foreground">{PAPER_SIZES[x.paper].label} · {x.detail}{x.id === deviceDefaultId ? ` · ${p.deviceDefault}` : ''}</span>
              </button>
            ))}
            <label className="mt-3 flex items-center gap-2 text-xs">
              <Checkbox checked={asDefault} onCheckedChange={(v) => setAsDefault(Boolean(v))} /> {p.setDeviceDefault}
            </label>
          </div>
          <div className="overflow-auto bg-muted/40 p-4">
            {context && profile ? (
              <div className="mx-auto w-fit shadow-lg">
                <style>{pageStyleFor(profile)}</style>
                <InvoiceDocument ref={ref} {...context} profile={profile} />
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter className="border-t px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{p.close}</Button>
          <Button
            disabled={!profile || busy}
            loading={busy}
            onClick={async () => {
              if (!profile) return;
              setBusy(true);
              try {
                if (asDefault) onSetDeviceDefault(profile.id);
                await onPrint(profile, ref.current);
                onOpenChange(false);
              } catch (error) {
                toast.error(p.printFailed, { description: error instanceof Error ? error.message : String(error) });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Printer /> {p.print}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
