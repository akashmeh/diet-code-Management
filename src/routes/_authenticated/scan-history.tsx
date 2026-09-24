import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchCheckpoints, fetchScans } from "@/lib/dietcode";
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel } from "@/components/ui-bits";
import { ScanTable } from "./dashboard";

export const Route = createFileRoute("/_authenticated/scan-history")({
  head: () => ({
    meta: [
      { title: "Scan History · DIET CODE Organizer" },
      { name: "description", content: "Chronological log of every DIET CODE attendance and checkpoint scan." },
      { property: "og:title", content: "Scan History · DIET CODE Organizer" },
      { property: "og:description", content: "Full DIET CODE scan log with organizer and timestamp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanHistoryPage,
});

function ScanHistoryPage() {
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => fetchScans(1000) });
  const checkpoints = useQuery({ queryKey: ["checkpoints"], queryFn: fetchCheckpoints });
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "attendance" | "checkpoint">("all");
  const [checkpointId, setCheckpointId] = useState("all");

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (scans.data ?? []).filter((scan) => {
      if (type !== "all" && scan.scan_type !== type) return false;
      if (checkpointId !== "all" && scan.checkpoint_id !== checkpointId) return false;
      if (!query) return true;
      return `${scan.teams?.team_id ?? ""} ${scan.teams?.team_name ?? ""} ${scan.organizer_email ?? ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [scans.data, search, type, checkpointId]);

  return (
    <>
      <PageHeader title="Scan History" description="Most recent scans first." />

      {scans.error ? (
        <ErrorState message={(scans.error as Error).message} />
      ) : scans.isLoading ? (
        <LoadingState />
      ) : (scans.data ?? []).length === 0 ? (
        <EmptyState title="No scans yet" description="Scans appear here as soon as you start scanning." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team or organizer…"
              className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            >
              <option value="all">All types</option>
              <option value="attendance">Attendance</option>
              <option value="checkpoint">Checkpoint</option>
            </select>
            <select
              value={checkpointId}
              onChange={(e) => setCheckpointId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            >
              <option value="all">All checkpoints</option>
              {(checkpoints.data ?? []).map((checkpoint) => (
                <option key={checkpoint.id} value={checkpoint.id}>
                  {checkpoint.name}
                </option>
              ))}
            </select>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {rows.length} scans
            </span>
          </div>

          <Panel className="overflow-hidden">
            {rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No scans match your filters.
              </p>
            ) : (
              <ScanTable scans={rows} />
            )}
          </Panel>
        </>
      )}
    </>
  );
}
