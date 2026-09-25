import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function PinDialog({
  open,
  title,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
          }}
        >
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
              Cancel
            </button>
            <button type="submit" autoFocus className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Confirm
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
