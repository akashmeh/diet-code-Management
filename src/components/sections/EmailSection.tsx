import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTeams, fetchEmailLogs, formatDateTime, type Team } from "@/lib/dietcode";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/ui-bits";
import { toast } from "sonner";
import { EmailConfirmDialog } from "@/components/EmailConfirmDialog";
import { sendBulkTicketEmailsFn } from "@/lib/email.server";

export function EmailSection() {
  const queryClient = useQueryClient();
  const { data: teams, isLoading, error } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const { data: logs } = useQuery({ queryKey: ["emailLogs"], queryFn: fetchEmailLogs });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "has_email" | "no_email" | "sent" | "not_sent">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; teams: Team[] }>({ open: false, teams: [] });
  const [sending, setSending] = useState(false);

  const teamList = useMemo(() => {
    let list = teams ?? [];
    
    // Apply filters
    if (filter === "has_email") list = list.filter((t) => !!t.captain_email);
    if (filter === "no_email") list = list.filter((t) => !t.captain_email);
    
    if (filter === "sent" || filter === "not_sent") {
      const sentTeamIds = new Set(logs?.filter(l => l.status === "sent").map(l => l.team_id) ?? []);
      if (filter === "sent") list = list.filter((t) => sentTeamIds.has(t.team_id));
      if (filter === "not_sent") list = list.filter((t) => !sentTeamIds.has(t.team_id));
    }

    // Apply search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => 
        t.team_id.toLowerCase().includes(q) || 
        t.team_name.toLowerCase().includes(q) ||
        (t.captain_email || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [teams, logs, search, filter]);

  const getLastLog = (teamId: string) => {
    return logs?.find(l => l.team_id === teamId);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === teamList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(teamList.map((t) => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkSend = async (isTest: boolean, testEmail: string) => {
    setConfirmDialog({ open: false, teams: [] });
    setSending(true);

    const teamIdsToProcess = confirmDialog.teams.map((t) => t.team_id);
    let successCount = 0;
    let failCount = 0;

    const toastId = toast.loading(`Sending ${teamIdsToProcess.length} emails...`);

    try {
      const results = await sendBulkTicketEmailsFn({
        data: {
          teamIds: teamIdsToProcess,
          isTest,
          testEmail,
          organizerEmail: "admin@dietcode.com" // Update from auth context if available
        }
      });
      
      results.forEach(res => {
        if (res.success) successCount++;
        else failCount++;
      });
      
      toast.success(`Sent: ${successCount}, Failed: ${failCount}`, { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["emailLogs"] });
    } catch (e: any) {
      toast.error(`Error sending emails: ${e.message}`, { id: toastId });
    } finally {
      setSending(false);
      setSelectedIds(new Set());
    }
  };

  if (error) return <ErrorState message={(error as Error).message} />;
  if (isLoading) return <LoadingState />;
  if (!teams?.length) return <EmptyState title="No teams yet" description="Import teams to send emails." />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team or email…"
          className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <div className="flex overflow-hidden rounded-md border border-border">
          {(["all", "has_email", "no_email", "sent", "not_sent"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-2 text-sm capitalize ${filter === v ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {v.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex gap-2 items-center">
        <button
          onClick={() => setConfirmDialog({ open: true, teams: teamList.filter(t => selectedIds.has(t.id)) })}
          disabled={selectedIds.size === 0 || sending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Send to Selected ({selectedIds.size})
        </button>
        <button
          onClick={() => setConfirmDialog({ open: true, teams: teamList.filter(t => selectedIds.has(t.id)) })}
          disabled={selectedIds.size === 0 || sending}
          className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          Test Send
        </button>
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={teamList.length > 0 && selectedIds.size === teamList.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer accent-current"
                  />
                </th>
                <th className="label-caps px-4 py-2.5">Team ID</th>
                <th className="label-caps px-4 py-2.5">Team Name</th>
                <th className="label-caps px-4 py-2.5">Captain Email</th>
                <th className="label-caps px-4 py-2.5">Last Status</th>
                <th className="label-caps px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {teamList.map((team) => {
                const log = getLastLog(team.team_id);
                return (
                  <tr key={team.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(team.id)}
                        onChange={() => toggleSelect(team.id)}
                        className="h-4 w-4 cursor-pointer accent-current"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{team.team_id}</td>
                    <td className="px-4 py-2.5 font-medium">{team.team_name}</td>
                    <td className="px-4 py-2.5">{team.captain_email || <span className="text-muted-foreground italic">None</span>}</td>
                    <td className="px-4 py-2.5">
                      {log ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide
                          ${log.status === "sent" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" : 
                            log.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400" : 
                            "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400"}`}>
                          {log.status}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <button
                        onClick={() => setConfirmDialog({ open: true, teams: [team] })}
                        disabled={sending || (!team.captain_email && !confirmDialog.open)} // Not disabled if test dialog logic can override
                        title={!team.captain_email ? "No email on file" : ""}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-50"
                      >
                        📧 Send
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {teamList.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No teams match criteria.</p>}
      </Panel>

      <EmailConfirmDialog
        open={confirmDialog.open}
        teams={confirmDialog.teams}
        onCancel={() => setConfirmDialog({ open: false, teams: [] })}
        onConfirm={handleBulkSend}
      />
    </>
  );
}
