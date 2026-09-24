import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchTeams, memberNames } from "@/lib/dietcode";
import { downloadTeamQr, printQrCard } from "@/lib/qr";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({
    meta: [
      { title: "Teams · DIET CODE Organizer" },
      { name: "description", content: "Searchable list of all DIET CODE teams and their QR passes." },
      { property: "og:title", content: "Teams · DIET CODE Organizer" },
      { property: "og:description", content: "All imported DIET CODE teams with attendance status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "checked-in" | "pending">("all");

  const teams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data ?? []).filter((team) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "checked-in" ? Boolean(team.checked_in_at) : !team.checked_in_at);
      if (!matchesFilter) return false;
      if (!query) return true;
      return [team.team_id, team.team_name, team.captain_name ?? "", ...memberNames(team)]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [data, search, filter]);

  return (
    <>
      <PageHeader
        title="Teams"
        description="All imported teams with registration and attendance status."
        actions={
          <Link
            to="/import"
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Import spreadsheet
          </Link>
        }
      />

      {error ? (
        <ErrorState message={(error as Error).message} />
      ) : isLoading ? (
        <LoadingState />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Upload the registration spreadsheet from the Import page."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team, captain or member…"
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
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {teams.length} / {data?.length} teams
            </span>
          </div>

          <Panel className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-caps px-4 py-2.5">Team ID</th>
                    <th className="label-caps px-4 py-2.5">Team Name</th>
                    <th className="label-caps px-4 py-2.5">Captain</th>
                    <th className="label-caps px-4 py-2.5">Members</th>
                    <th className="label-caps px-4 py-2.5">Registration</th>
                    <th className="label-caps px-4 py-2.5">Attendance</th>
                    <th className="label-caps px-4 py-2.5 text-right">QR</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs">
                        <Link to="/teams/$teamId" params={{ teamId: team.id }} className="hover:underline">
                          {team.team_id}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          to="/teams/$teamId"
                          params={{ teamId: team.id }}
                          className="font-medium hover:underline"
                        >
                          {team.team_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {team.captain_name ?? "—"}
                      </td>
                      <td className="max-w-[16rem] truncate px-4 py-2.5 text-muted-foreground">
                        {memberNames(team).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill>{team.registration_status}</StatusPill>
                      </td>
                      <td className="px-4 py-2.5">
                        {team.checked_in_at ? (
                          <StatusPill tone="solid">Checked in</StatusPill>
                        ) : (
                          <StatusPill>Pending</StatusPill>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <button
                          onClick={() =>
                            downloadTeamQr(team).catch(() => toast.error("Could not build the QR card."))
                          }
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        >
                          Download
                        </button>
                        <button
                          onClick={() =>
                            printQrCard(team).catch(() => toast.error("Could not open print view."))
                          }
                          className="ml-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        >
                          Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {teams.length === 0 && (
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
