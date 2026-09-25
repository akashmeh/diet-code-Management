import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo, type ReactNode } from "react";
import { fetchScans, fetchTeams, formatDateTime, type Scan } from "@/lib/dietcode";
import { getQueue } from "@/lib/offline";
import { StatCard } from "@/components/ui-bits";
import { TeamsSection } from "@/components/sections/TeamsSection";
import { ScannerSection } from "@/components/sections/ScannerSection";
import { ImportSection } from "@/components/sections/ImportSection";
import { AddTeamSection } from "@/components/sections/AddTeamSection";
import { QrSection } from "@/components/sections/QrSection";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Event Console · DIET CODE" },
      { name: "description", content: "Teams, attendance, scanner, import and QR codes for DIET CODE on one page." },
      { property: "og:title", content: "Event Console · DIET CODE" },
      { property: "og:description", content: "One-page DIET CODE organizer console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-left"
      >
        <span className="text-base font-semibold">{title}</span>
        <span className="font-mono text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {/* Only mount when open — keeps the page fast */}
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}

function DashboardPage() {
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => fetchScans(500) });
  const [queue, setQueue] = useState(() => getQueue());

  useEffect(() => {
    const handle = () => setQueue(getQueue());
    window.addEventListener("dietcode-queue", handle);
    return () => window.removeEventListener("dietcode-queue", handle);
  }, []);

  const allScans = useMemo(() => {
    const dbScans = scans.data ?? [];
    
    // Map queued scans to the Scan type
    const pendingScans: (Scan & { _isOffline?: boolean })[] = queue.map((q) => ({
      id: q.id,
      team_uuid: q.team_uuid,
      checkpoint_id: q.checkpoint_id,
      scan_type: q.scan_type,
      organizer_email: "You (Offline)",
      is_override: q.is_override,
      scanned_at: q.scanned_at,
      teams: { team_id: q.team_id, team_name: q.team_name },
      checkpoints: q.checkpoint_name ? { name: q.checkpoint_name } : null,
      _isOffline: true,
    }));

    // Combine and sort descending by time
    const combined = [...pendingScans, ...dbScans].sort(
      (a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime(),
    );

    // Remove duplicates (by ID) in case a synced scan hasn't been removed from UI yet
    const seen = new Set();
    return combined.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [scans.data, queue]);

  const total = teams.data?.length ?? 0;
  const present = teams.data?.filter((t) => t.checked_in_at).length ?? 0;
  const checkpointScans = scans.data?.filter((s) => s.scan_type === "checkpoint").length ?? 0;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Teams" value={total} />
        <StatCard label="Present" value={present} />
        <StatCard label="Absent" value={total - present} />
        <StatCard label="Checkpoints Done" value={checkpointScans} />
        <StatCard label="Total Scans" value={allScans.length} />
      </div>

      <Section title="Recent Scans" defaultOpen>
        <ScanTable scans={allScans} />
      </Section>

      <Section title="Scanner" defaultOpen>
        <ScannerSection />
      </Section>
      <Section title="Teams & Attendance" defaultOpen>
        <TeamsSection />
      </Section>
      <Section title="Import Spreadsheet">
        <ImportSection />
      </Section>
      <Section title="Add Team Manually">
        <AddTeamSection />
      </Section>
      <Section title="QR Codes">
        <QrSection />
      </Section>
    </>
  );
}

export function ScanTable({ scans }: { scans: (Scan & { _isOffline?: boolean })[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="label-caps px-4 py-2.5">Time</th>
            <th className="label-caps px-4 py-2.5">Team</th>
            <th className="label-caps px-4 py-2.5">Type</th>
            <th className="label-caps px-4 py-2.5">Checkpoint</th>
            <th className="label-caps px-4 py-2.5">Status</th>
            <th className="label-caps px-4 py-2.5">Organizer</th>
          </tr>
        </thead>
        <tbody>
          {scans.slice(0, 50).map((scan) => (
            <tr key={scan.id} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {formatDateTime(scan.scanned_at)}
              </td>
              <td className="px-4 py-2.5">
                <span className="font-mono text-xs text-muted-foreground">{scan.teams?.team_id ?? "—"}</span>{" "}
                {scan.teams?.team_name ?? ""}
              </td>
              <td className="px-4 py-2.5 capitalize">
                {scan.scan_type}
                {scan.is_override && (
                  <span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">override</span>
                )}
              </td>
              <td className="px-4 py-2.5">{scan.checkpoints?.name ?? "—"}</td>
              <td className="px-4 py-2.5">
                {scan._isOffline ? (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400">
                    Pending Sync
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-400">
                    Synced
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{scan.organizer_email ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
