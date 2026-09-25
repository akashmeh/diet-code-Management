import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type Team } from "@/lib/dietcode";
import { Checkbox } from "@/components/ui/checkbox"; // Assuming this exists or use plain input

export function EmailConfirmDialog({
  open,
  teams,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  teams: Team[];
  onCancel: () => void;
  onConfirm: (isTest: boolean, testEmail: string) => void;
}) {
  const [isTest, setIsTest] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    if (open) {
      setIsTest(false);
      setTestEmail("");
    }
  }, [open]);

  const missingEmailCount = teams.filter((t) => !t.captain_email).length;
  const validEmailCount = teams.length - missingEmailCount;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Email Sending</DialogTitle>
          <DialogDescription>
            You are about to send ticket emails to {teams.length} team(s).
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {missingEmailCount > 0 && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
              <strong>Warning:</strong> {missingEmailCount} team(s) have no captain email on file and will be skipped unless in test mode.
            </div>
          )}

          <div className="text-sm">
            Will send to: <strong>{validEmailCount} valid recipients</strong>
          </div>

          <div className="border border-border p-3 rounded-md space-y-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isTest}
                onChange={(e) => setIsTest(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium">Test Send (Override Recipient)</span>
            </label>
            
            {isTest && (
              <div>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter test email address"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(isTest, testEmail)}
            disabled={isTest && !testEmail}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Confirm Send
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
