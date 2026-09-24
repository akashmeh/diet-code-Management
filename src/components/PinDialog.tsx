import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const PIN = "442026";

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
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Enter PIN</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin === PIN) onConfirm();
            else {
              setError(true);
              setPin("");
            }
          }}
        >
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError(false);
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-center font-mono tracking-widest outline-none focus:border-ring"
          />
          {error && <p className="mt-2 text-sm">Wrong PIN.</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
              Cancel
            </button>
            <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Confirm
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
