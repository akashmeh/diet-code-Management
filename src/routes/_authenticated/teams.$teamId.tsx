import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchTeamScans, formatDateTime, memberNames, type Team } from "@/lib/dietcode";
import { downloadTeamQr, downloadTeamQrPng, printQrCard, qrDataUrl } from "@/lib/qr";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/teams/$teamId")({
  head: () => ({
    meta: [
      { title: "Team details · DIET CODE Organizer" },
      { name: "description", content: "Team details, QR pass, attendance status and scan history." },
      { property: "og:title", content: "Team details · DIET CODE Organizer" },
      { property: "og:description", content: "DIET CODE team record with QR pass and scan history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamDetailPage,
});

function TeamDetailPage() {
  const { teamId } = Route.useParams();

  const teamQuery = useQuery({
    queryKey: ["team", teamId],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").eq("id", teamId).maybeSingle();
      if (error) throw error;
      return (data as unknown as Team) ?? null;
    },
  });

  const scansQuery = useQuery({
    queryKey: ["team-scans", teamId],
    queryFn: () => fetchTeamScans(teamId),
  });

  const [qr, setQr] = useState<string | null>(null);
  const team = teamQuery.data;

  useEffect(() => {
    if (team) qrDataUrl(team.qr_token, 320).then(setQr).catch(() => setQr(null));
  }, [team]);

  if (teamQuery.error) return <ErrorState message={(teamQuery.error as Error).message} />;
  if (teamQuery.isLoading) return <LoadingState />;
  if (!team)
    return (
      <>
        <PageHeader title="Team not found" />
        <Link to="/dashboard" className="text-sm underline">
          Back to teams
        </Link>
      </>
    );

  return (
    <>
      <PageHeader
        title={team.team_name}
        description={`Team ID ${team.team_id}`}
        actions={
          <Link
            to="/dashboard"
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Back to teams
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="px-5 py-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Details</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Detail label="Captain" value={team.captain_name} />
            <Detail label="Captain Email" value={team.captain_email} />
            <Detail label="Captain Phone" value={team.captain_phone} />
            <Detail label="Department" value={team.department} />
            <Detail label="Register Number" value={team.register_number} />
            <Detail label="Team Size" value={team.team_size ? String(team.team_size) : null} />
            <Detail label="Members" value={memberNames(team).join(", ") || null} />
            <Detail label="Registration" value={team.registration_status} />
          </dl>
          <div className="mt-5 flex items-center gap-3 border-t border-border pt-5">
            {team.checked_in_at ? (
              <>
                <StatusPill tone="solid">Checked in</StatusPill>
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(team.checked_in_at)}
                </span>
              </>
            ) : (
              <StatusPill>Attendance pending</StatusPill>
            )}
          </div>
        </Panel>

        <Panel className="px-5 py-5 text-center">
          <h2 className="text-sm font-semibold">QR pass</h2>
          {qr ? (
            <img src={qr} alt={`QR code for ${team.team_name}`} className="mx-auto mt-4 w-40" />
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Preparing QR…</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Scan to verify</p>
          <div className="mt-5 grid gap-2">
            <button
              onClick={() => downloadTeamQr(team).catch(() => toast.error("Download failed."))}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Download card (SVG)
            </button>
            <button
              onClick={() => downloadTeamQrPng(team).catch(() => toast.error("Download failed."))}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              Download QR (PNG)
            </button>
            <button
              onClick={() => printQrCard(team).catch(() => toast.error("Print failed."))}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              Print card
            </button>
          </div>
        </Panel>
      </div>

      <Panel className="mt-6 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Scan history</h2>
        </div>
        {scansQuery.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (scansQuery.data ?? []).length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No scans for this team yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps px-4 py-2.5">Time</th>
                <th className="label-caps px-4 py-2.5">Type</th>
                <th className="label-caps px-4 py-2.5">Checkpoint</th>
                <th className="label-caps px-4 py-2.5">Organizer</th>
              </tr>
            </thead>
            <tbody>
              {(scansQuery.data ?? []).map((scan) => (
                <tr key={scan.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {formatDateTime(scan.scanned_at)}
                  </td>
                  <td className="px-4 py-2.5 capitalize">{scan.scan_type}</td>
                  <td className="px-4 py-2.5">{scan.checkpoints?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{scan.organizer_email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value ?? "—"}</dd>
    </div>
  );
}
