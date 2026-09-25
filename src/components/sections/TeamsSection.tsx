import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchTeams, formatDateTime, memberNames, setTeamPresent, deleteTeam, type Team } from "@/lib/dietcode";
import { downloadTeamQr, printQrCard } from "@/lib/qr";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import { PinDialog } from "@/components/PinDialog";
import { cacheTeams } from "@/lib/offline";

export function TeamsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const rows = await fetchTeams();
      cacheTeams(rows);
      return rows;
    },
  });
  const [confirmTeam, setConfirmTeam] = useState<Team | null>(null);
  const [deleteTeamConfirm, setDeleteTeamConfirm] = useState<Team | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "present" | "absent">("all");
  const [pending, setPending] = useState<string | null>(null);

  const teams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((t) => {
      if (filter === "present" && !t.checked_in_at) return false;
      if (filter === "absent" && t.checked_in_at) return false;
      if (!q) return true;
      return [t.team_id, t.team_name, t.captain_name ?? "", ...memberNames(t)].join(" ").toLowerCase().includes(q);
    });
  }, [data, search, filter]);

  async function toggle(team: Team) {
    const present = !team.checked_in_at;
    setPending(team.id);
    // optimistic update
    queryClient.setQueryData<Team[]>(["teams"], (old) =>
      old?.map((t) => (t.id === team.id ? { ...t, checked_in_at: present ? new Date().toISOString() : null } : t)),
    );
    try {
      await setTeamPresent(team.id, present);
      queryClient.invalidateQueries({ queryKey: ["scans"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update attendance.");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    } finally {
      setPending(null);
    }
  }

  async function handleDeleteTeam(team: Team) {
    setPending(team.id);
    try {
      await deleteTeam(team.id);
      toast.success(`Team ${team.team_name} deleted.`);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["scans"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete team.");
    } finally {
      setPending(null);
    }
  }

  if (error) return <ErrorState message={(error as Error).message} />;
  if (isLoading) return <LoadingState />;
  if (!data?.length) return <EmptyState title="No teams yet" description="Import the registration spreadsheet below." />;

  const presentCount = data.filter((t) => t.checked_in_at).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team, captain or member…"
          className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <div className="flex overflow-hidden rounded-md border border-border">
          {(["all", "present", "absent"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-2 text-sm capitalize ${filter === v ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {presentCount} present · {data.length - presentCount} absent · {data.length} total
        </span>
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps px-4 py-2.5">Present</th>
                <th className="label-caps px-4 py-2.5">Team ID</th>
                <th className="label-caps px-4 py-2.5">Team Name</th>
                <th className="label-caps px-4 py-2.5">Captain</th>
                <th className="label-caps px-4 py-2.5">Members</th>
                <th className="label-caps px-4 py-2.5">Checked in</th>
                <th className="label-caps px-4 py-2.5 text-right">QR</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => {
                const present = Boolean(team.checked_in_at);
                return (
                  <tr
                    key={team.id}
                    className={cn("border-b border-border last:border-0", present && "bg-present text-present-foreground")}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Mark ${team.team_name} present`}
                        checked={present}
                        disabled={pending === team.id}
                        onChange={() => setConfirmTeam(team)}
                        className="h-4 w-4 cursor-pointer accent-current"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link to="/teams/$teamId" params={{ teamId: team.id }} className="hover:underline">
                        {team.team_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-medium">{team.team_name}</td>
                    <td className="px-4 py-2.5">{team.captain_name ?? "—"}</td>
                    <td className="max-w-[16rem] truncate px-4 py-2.5">{memberNames(team).join(", ") || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                      {team.checked_in_at ? formatDateTime(team.checked_in_at) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <button
                        onClick={() => downloadTeamQr(team).catch(() => toast.error("Could not build the QR card."))}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-accent"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => printQrCard(team).catch(() => toast.error("Could not open print view."))}
                        className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-accent"
                      >
                        Print
                      </button>
                      <button
                        onClick={() => setDeleteTeamConfirm(team)}
                        className="ml-2 rounded-md border border-red-200 bg-background px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {teams.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No teams match.</p>}
      </Panel>
      <PinDialog
        open={Boolean(confirmTeam)}
        title={confirmTeam ? `${confirmTeam.checked_in_at ? "Mark absent" : "Mark present"}: ${confirmTeam.team_name}` : ""}
        onCancel={() => setConfirmTeam(null)}
        onConfirm={() => {
          const t = confirmTeam;
          setConfirmTeam(null);
          if (t) void toggle(t);
        }}
      />
      <PinDialog
        open={Boolean(deleteTeamConfirm)}
        title={deleteTeamConfirm ? `Delete Team: ${deleteTeamConfirm.team_name}` : ""}
        onCancel={() => setDeleteTeamConfirm(null)}
        onConfirm={() => {
          const t = deleteTeamConfirm;
          setDeleteTeamConfirm(null);
          if (t) void handleDeleteTeam(t);
        }}
      />
    </>
  );
}
