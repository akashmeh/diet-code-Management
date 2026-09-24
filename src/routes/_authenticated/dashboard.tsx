import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { fetchScans, fetchTeams, formatDateTime, type Scan } from "@/lib/dietcode";
import { StatCard } from "@/components/ui-bits";
import { TeamsSection } from "@/components/sections/TeamsSection";
import { ScannerSection } from "@/components/sections/ScannerSection";
import { ImportSection } from "@/components/sections/ImportSection";
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
        <StatCard label="Total Scans" value={scans.data?.length ?? 0} />
      </div>

      <Section title="Scanner" defaultOpen>
        <ScannerSection />
      </Section>
      <Section title="Teams & Attendance" defaultOpen>
        <TeamsSection />
      </Section>
      <Section title="Import Spreadsheet">
        <ImportSection />
      </Section>
      <Section title="QR Codes">
        <QrSection />
      </Section>
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
              <td className="px-4 py-2.5 text-muted-foreground">{scan.organizer_email ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
