import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Panel, LoadingState, ErrorState, StatusPill } from "@/components/ui-bits";
import { fetchParticipantsFn, sendTestCertificateFn, sendCertificatesFn, importCertificatesFn, deleteCertificatesFn, type ParticipantRecord } from "@/lib/certificates.server";
import { readSheet } from "@/lib/spreadsheet";

export function CertificatesSection() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "checked_in" | "not_sent">("all");
  const [search, setSearch] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  
  const [testName, setTestName] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["certificates", filter],
    queryFn: () => fetchParticipantsFn({ data: { filter } }),
  });

  const participants = useMemo(() => {
    let list = data?.participants ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => 
        p.participantName.toLowerCase().includes(q) ||
        p.participantEmail.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, search]);

  const toggleSelectAll = () => {
    if (selectedEmails.size === participants.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(participants.map((p) => p.participantEmail)));
    }
  };

  const toggleSelect = (email: string) => {
    const newSet = new Set(selectedEmails);
    if (newSet.has(email)) newSet.delete(email);
    else newSet.add(email);
    setSelectedEmails(newSet);
  };

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testName || !testEmail) return toast.error("Name and test email required.");
    setSendingTest(true);
    try {
      const res = await sendTestCertificateFn({ data: { name: testName, testEmail } });
      if (res.success) toast.success("Test certificate sent!");
      else toast.error(res.error || "Failed to send test.");
    } catch (err: any) {
      toast.error(err.message || "Error sending test.");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSendBulk() {
    if (selectedEmails.size === 0) return toast.error("Select participants first.");
    const selected = participants.filter(p => selectedEmails.has(p.participantEmail));
    
    setSendingBulk(true);
    const toastId = toast.loading(`Sending ${selected.length} certificates...`);
    try {
      const res = await sendCertificatesFn({ data: { participants: selected } });
      toast.success(`Sent: ${res.sent}, Failed: ${res.failed}`, { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      setSelectedEmails(new Set());
    } catch (err: any) {
      toast.error(err.message || "Failed to send bulk certificates.", { id: toastId });
    } finally {
      setSendingBulk(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    const toastId = toast.loading("Importing participants...");
    try {
      const buffer = await file.arrayBuffer();
      const { rows } = readSheet(buffer);
      
      // Auto map loosely (looks for name and email variants)
      const parsed = rows.map(r => {
        let name = "";
        let email = "";
        for (const [k, v] of Object.entries(r)) {
          if (!v) continue;
          const key = k.trim().toLowerCase();
          if (key.includes("name")) name = String(v).trim();
          else if (key.includes("mail")) email = String(v).trim();
        }
        return { name, email };
      }).filter(p => p.name && p.email);

      if (parsed.length === 0) {
        toast.error("No names and emails found in sheet.", { id: toastId });
        return;
      }

      const res = await importCertificatesFn({ data: { participants: parsed } });
      toast.success(`Imported ${res.imported}, Skipped ${res.failed} (duplicates)`, { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to import.", { id: toastId });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeleteBulk() {
    if (selectedEmails.size === 0) return toast.error("Select participants to delete.");
    if (!confirm("Are you sure you want to delete these records? (Note: Team members will still appear as part of their teams, but imported standalone participants will be permanently removed).")) return;
    
    setDeleting(true);
    const toastId = toast.loading("Deleting records...");
    
    // Find trackingIds for the selected emails
    const selected = participants.filter(p => selectedEmails.has(p.participantEmail) && p.trackingId);
    const trackingIds = selected.map(p => p.trackingId!);
    
    if (trackingIds.length === 0) {
      toast.success("No tracking records to delete.", { id: toastId });
      setDeleting(false);
      return;
    }

    try {
      await deleteCertificatesFn({ data: { trackingIds } });
      toast.success(`Deleted ${trackingIds.length} records.`, { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      setSelectedEmails(new Set());
    } catch (err: any) {
      toast.error(err.message || "Failed to delete.", { id: toastId });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Test Send Form */}
      <Panel className="p-4 bg-muted/30">
        <h3 className="text-sm font-semibold mb-3">Send Test Certificate</h3>
        <form onSubmit={handleSendTest} className="flex flex-wrap gap-3 items-end">
          <label className="grid gap-1.5 flex-1 min-w-[200px]">
            <span className="text-xs font-medium">Name</span>
            <input 
              type="text" 
              className="rounded-md border px-3 py-2 text-sm" 
              value={testName} 
              onChange={e => setTestName(e.target.value)} 
              placeholder="Test Participant" 
            />
          </label>
          <label className="grid gap-1.5 flex-1 min-w-[200px]">
            <span className="text-xs font-medium">Test Email</span>
            <input 
              type="email" 
              className="rounded-md border px-3 py-2 text-sm" 
              value={testEmail} 
              onChange={e => setTestEmail(e.target.value)} 
              placeholder="test@example.com" 
            />
          </label>
          <button 
            type="submit" 
            disabled={sendingTest}
            className="rounded-md bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
          >
            {sendingTest ? "Sending..." : "Send Test"}
          </button>
        </form>
      </Panel>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select 
            className="rounded-md border px-3 py-1.5 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">All Participants</option>
            <option value="checked_in">Checked In Only</option>
            <option value="not_sent">Not Sent</option>
          </select>
          <input
            type="text"
            placeholder="Search name, email, or team..."
            className="rounded-md border px-3 py-1.5 text-sm w-[250px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            ref={fileRef}
            onChange={handleImport}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import from Sheet"}
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={handleDeleteBulk}
            disabled={deleting || selectedEmails.size === 0}
            className="rounded-md bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2 text-sm font-medium hover:bg-destructive/20 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : `Delete (${selectedEmails.size})`}
          </button>
          <button
            onClick={handleSendBulk}
            disabled={sendingBulk || selectedEmails.size === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {sendingBulk ? "Sending..." : `Send to Selected (${selectedEmails.size})`}
          </button>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <ErrorState message={(error as Error).message} />
      ) : isLoading ? (
        <LoadingState />
      ) : participants.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border rounded-md">
          No participants match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedEmails.size === participants.length && participants.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="px-4 py-3 font-medium">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {participants.map((p) => (
                <tr key={`${p.teamUuid}_${p.participantEmail}`} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedEmails.size > 0 && selectedEmails.has(p.participantEmail)}
                      onChange={() => toggleSelect(p.participantEmail)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{p.participantName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.participantEmail}</td>
                  <td className="px-4 py-3">{p.teamName}</td>
                  <td className="px-4 py-3">
                    {p.isCheckedIn ? (
                      <span className="text-green-600 font-medium text-xs">Checked In</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Absent</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.certificateSent ? (
                      <span className="text-blue-600 font-medium text-xs">Sent</span>
                    ) : p.certificateSendError ? (
                      <span className="text-red-600 font-medium text-xs" title={p.certificateSendError}>Error</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Not Sent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
