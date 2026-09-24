import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchTeams, formatDateTime } from "@/lib/dietcode";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
} from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance · DIET CODE Organizer" },
      { name: "description", content: "Check-in status and time for every DIET CODE team." },
      { property: "og:title", content: "Attendance · DIET CODE Organizer" },
      { property: "og:description", content: "DIET CODE team check-in tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "checked-in" | "pending">("all");

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data ?? []).filter((team) => {
      const matches =
        filter === "all" ||
        (filter === "checked-in" ? Boolean(team.checked_in_at) : !team.checked_in_at);
      if (!matches) return false;
      if (!query) return true;
      return `${team.team_id} ${team.team_name} ${team.captain_name ?? ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [data, search, filter]);

  const checkedIn = (data ?? []).filter((t) => t.checked_in_at).length;

  return (
    <>
      <PageHeader title="Attendance" description="Check-in status for every team." />

      {error ? (
        <ErrorState message={(error as Error).message} />
      ) : isLoading ? (
        <LoadingState />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No teams yet" description="Import teams to start tracking attendance." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total Teams" value={data?.length ?? 0} />
            <StatCard label="Checked In" value={checkedIn} />
            <StatCard label="Pending" value={(data?.length ?? 0) - checkedIn} />
          </div>

          <div className="mb-4 mt-6 flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team or captain…"
              className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <div className="flex overflow-hidden rounded-md border border-border">
              {(["all", "checked-in", "pending"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-3 py-2 text-sm capitalize ${
                    filter === value ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {value.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>

          <Panel className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-caps px-4 py-2.5">Team ID</th>
                    <th className="label-caps px-4 py-2.5">Team Name</th>
                    <th className="label-caps px-4 py-2.5">Captain</th>
                    <th className="label-caps px-4 py-2.5">Status</th>
                    <th className="label-caps px-4 py-2.5">Check-in time</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((team) => (
                    <tr key={team.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs">
                        <Link to="/teams/$teamId" params={{ teamId: team.id }} className="hover:underline">
                          {team.team_id}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{team.team_name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{team.captain_name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {team.checked_in_at ? (
                          <StatusPill tone="solid">Checked in</StatusPill>
                        ) : (
                          <StatusPill>Pending</StatusPill>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {formatDateTime(team.checked_in_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No teams match your search.
              </p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
