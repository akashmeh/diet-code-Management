import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchTeams, type Team } from "@/lib/dietcode";
import { downloadAllQrZip, downloadTeamQr, printQrCard, qrDataUrl } from "@/lib/qr";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/qr-codes")({
  head: () => ({
    meta: [
      { title: "QR Codes · DIET CODE Organizer" },
      { name: "description", content: "View, download and print printable QR passes for every DIET CODE team." },
      { property: "og:title", content: "QR Codes · DIET CODE Organizer" },
      { property: "og:description", content: "Printable DIET CODE team QR cards, individually or as a ZIP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QrCodesPage,
});

function QrCodesPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const [search, setSearch] = useState("");
  const [zipProgress, setZipProgress] = useState<number | null>(null);

  const teams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data ?? [];
    return (data ?? []).filter((team) =>
      `${team.team_id} ${team.team_name}`.toLowerCase().includes(query),
    );
  }, [data, search]);

  async function downloadAll() {
    if (!data?.length) return;
    setZipProgress(0);
    try {
      await downloadAllQrZip(data, (done) => setZipProgress(done));
      toast.success("ZIP with all printable QR cards downloaded.");
    } catch {
      toast.error("Could not build the ZIP file.");
    } finally {
      setZipProgress(null);
    }
  }

  return (
    <>
      <PageHeader
        title="QR Codes"
        description="Each QR carries only a secure random token — no participant data."
        actions={
          <button
            onClick={downloadAll}
            disabled={!data?.length || zipProgress !== null}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {zipProgress === null
              ? "Download All QR Codes (ZIP)"
              : `Building… ${zipProgress}/${data?.length}`}
          </button>
        }
      />

      {error ? (
        <ErrorState message={(error as Error).message} />
      ) : isLoading ? (
        <LoadingState />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No QR codes yet" description="Import teams first — QR tokens are created automatically." />
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team…"
            className="mb-5 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <QrCard key={team.id} team={team} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function QrCard({ team }: { team: Team }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    qrDataUrl(team.qr_token, 260).then(setSrc).catch(() => setSrc(null));
  }, [team.qr_token]);

  return (
    <div className="panel flex flex-col items-center px-4 py-5 text-center">
      <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">DIET CODE</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{team.team_id}</p>
      <p className="mt-1 truncate text-sm font-medium">{team.team_name}</p>
      {src ? (
        <img src={src} alt={`QR code for ${team.team_name}`} className="mt-3 w-32" />
      ) : (
        <div className="mt-3 h-32 w-32 animate-pulse rounded bg-muted" />
      )}
      <p className="mt-2 text-xs text-muted-foreground">Scan to verify</p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => downloadTeamQr(team).catch(() => toast.error("Download failed."))}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
        >
          Download
        </button>
        <button
          onClick={() => printQrCard(team).catch(() => toast.error("Print failed."))}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
        >
          Print
        </button>
      </div>
    </div>
  );
}
