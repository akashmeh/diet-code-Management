import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCheckpoints,
  fetchScans,
  fetchTeams,
  formatDateTime,
  type Scan,
} from "@/lib/dietcode";
import { EmptyState, ErrorState, LoadingState, PageHeader, StatCard } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · DIET CODE Organizer" },
      { name: "description", content: "Live team, attendance and checkpoint statistics for DIET CODE." },
      { property: "og:title", content: "Dashboard · DIET CODE Organizer" },
      { property: "og:description", content: "Live DIET CODE event statistics and recent scans." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => fetchScans(500) });
  const checkpoints = useQuery({ queryKey: ["checkpoints"], queryFn: fetchCheckpoints });

  const isLoading = teams.isLoading || scans.isLoading || checkpoints.isLoading;
  const error = teams.error ?? scans.error ?? checkpoints.error;

  const total = teams.data?.length ?? 0;
  const checkedIn = teams.data?.filter((t) => t.checked_in_at).length ?? 0;
  const checkpointScans = scans.data?.filter((s) => s.scan_type === "checkpoint").length ?? 0;
  const recent = (scans.data ?? []).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live figures from the event database."
      />

      {error ? (
        <ErrorState message={(error as Error).message} />
      ) : isLoading ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total Teams" value={total} />
            <StatCard label="Checked In" value={checkedIn} />
            <StatCard label="Pending" value={total - checkedIn} />
            <StatCard label="Checkpoints Done" value={checkpointScans} />
            <StatCard label="Total Scans" value={scans.data?.length ?? 0} />
          </div>

          <div className="panel mt-8 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Recent scans</h2>
              <Link to="/scan-history" className="text-xs text-muted-foreground hover:underline">
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No scans recorded yet.
              </p>
            ) : (
              <ScanTable scans={recent} />
            )}
          </div>

          {total === 0 && (
            <div className="mt-8">
              <EmptyState
                title="No teams imported yet"
                description="Upload your registration spreadsheet from the Import page to get started."
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

export function ScanTable({ scans }: { scans: Scan[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="label-caps px-4 py-2.5">Time</th>
            <th className="label-caps px-4 py-2.5">Team</th>
            <th className="label-caps px-4 py-2.5">Type</th>
            <th className="label-caps px-4 py-2.5">Checkpoint</th>
            <th className="label-caps px-4 py-2.5">Organizer</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => (
            <tr key={scan.id} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {formatDateTime(scan.scanned_at)}
              </td>
              <td className="px-4 py-2.5">
                <span className="font-mono text-xs text-muted-foreground">
                  {scan.teams?.team_id ?? "—"}
                </span>{" "}
                {scan.teams?.team_name ?? ""}
              </td>
              <td className="px-4 py-2.5 capitalize">
                {scan.scan_type}
                {scan.is_override && (
                  <span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">
                    override
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5">{scan.checkpoints?.name ?? "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{scan.organizer_email ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
