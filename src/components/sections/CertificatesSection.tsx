import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Panel, LoadingState, ErrorState, StatusPill } from "@/components/ui-bits";
import { fetchParticipantsFn, sendTestCertificateFn, sendCertificatesFn, type ParticipantRecord } from "@/lib/certificates.server";

export function CertificatesSection() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "checked_in" | "not_sent">("all");
  const [search, setSearch] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  
  const [testName, setTestName] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);

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
        <div className="flex items-center gap-3">
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
        </div>
        <button
          onClick={handleSendBulk}
          disabled={sendingBulk || selectedEmails.size === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {sendingBulk ? "Sending..." : `Send to Selected (${selectedEmails.size})`}
        </button>
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
