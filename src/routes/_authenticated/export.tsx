import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchScans, fetchTeams, formatDateTime, memberNames } from "@/lib/dietcode";
import { downloadCsv, downloadXlsx } from "@/lib/spreadsheet";
import { ErrorState, LoadingState, PageHeader, Panel } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/export")({
  head: () => ({
    meta: [
      { title: "Export · DIET CODE Organizer" },
      { name: "description", content: "Download DIET CODE attendance, team information and scan history as CSV or Excel." },
      { property: "og:title", content: "Export · DIET CODE Organizer" },
      { property: "og:description", content: "CSV and Excel exports for DIET CODE event data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExportPage,
});

function ExportPage() {
  const teams = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => fetchScans(1000) });

  const teamRows = () =>
    (teams.data ?? []).map((team) => ({
      "Team ID": team.team_id,
      "Team Name": team.team_name,
      Captain: team.captain_name ?? "",
      "Captain Email": team.captain_email ?? "",
      "Captain Phone": team.captain_phone ?? "",
      Department: team.department ?? "",
      "Register Number": team.register_number ?? "",
      "Team Size": team.team_size ?? "",
      Members: memberNames(team).join(" | "),
      "Registration Status": team.registration_status,
      "QR Token": team.qr_token,
    }));

  const attendanceRows = () =>
    (teams.data ?? []).map((team) => ({
      "Team ID": team.team_id,
      "Team Name": team.team_name,
      Captain: team.captain_name ?? "",
      Status: team.checked_in_at ? "Checked In" : "Pending",
      "Check-in Time": team.checked_in_at ? formatDateTime(team.checked_in_at) : "",
    }));

  const scanRows = () =>
    (scans.data ?? []).map((scan) => ({
      Time: formatDateTime(scan.scanned_at),
      "Team ID": scan.teams?.team_id ?? "",
      "Team Name": scan.teams?.team_name ?? "",
      Type: scan.scan_type,
      Checkpoint: scan.checkpoints?.name ?? "",
      Organizer: scan.organizer_email ?? "",
      Override: scan.is_override ? "Yes" : "No",
    }));

  const sets = [
    { key: "attendance", title: "Attendance", rows: attendanceRows, file: "diet-code-attendance" },
    { key: "teams", title: "Team information", rows: teamRows, file: "diet-code-teams" },
    { key: "scans", title: "Scan history", rows: scanRows, file: "diet-code-scan-history" },
  ];

  const isLoading = teams.isLoading || scans.isLoading;
  const error = teams.error ?? scans.error;

  function download(kind: "csv" | "xlsx", rows: Record<string, unknown>[], file: string) {
    if (!rows.length) {
      toast.error("There is no data to export yet.");
      return;
    }
    if (kind === "csv") downloadCsv(`${file}.csv`, rows);
    else downloadXlsx(`${file}.xlsx`, rows);
    toast.success("Export downloaded.");
  }

  return (
    <>
      <PageHeader title="Export" description="Download event data as CSV or Excel." />

      {error ? (
        <ErrorState message={(error as Error).message} />
      ) : isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {sets.map((set) => {
            const count = set.rows().length;
            return (
              <Panel key={set.key} className="px-5 py-5">
                <p className="text-sm font-semibold">{set.title}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{count} rows</p>
                <div className="mt-5 grid gap-2">
                  <button
                    onClick={() => download("csv", set.rows(), set.file)}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Download CSV
                  </button>
                  <button
                    onClick={() => download("xlsx", set.rows(), set.file)}
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                  >
                    Download Excel
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
