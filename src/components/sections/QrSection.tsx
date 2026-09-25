import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchTeams, type Team } from "@/lib/dietcode";
import { downloadAllQrZip, printQrCard, qrDataUrl } from "@/lib/qr";
import { downloadTicketAsPdf } from "@/lib/pdf";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui-bits";
import { EmailConfirmDialog } from "@/components/EmailConfirmDialog";
import { sendTicketEmailFn } from "@/lib/email.server";


export function QrSection() {
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
  const [emailOpen, setEmailOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    qrDataUrl(team.qr_token, 260).then(setSrc).catch(() => setSrc(null));
  }, [team.qr_token]);

  const handleEmail = async (isTest: boolean, testEmail: string) => {
    setEmailOpen(false);
    const toastId = toast.loading("Sending email...");
    try {
      const res = await sendTicketEmailFn({ data: { teamId: team.team_id, isTest, testEmail }});
      if (res.success) toast.success("Email sent", { id: toastId });
      else toast.error("Failed: " + res.message, { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["emailLogs"] });
    } catch (e: any) {
      toast.error("Error: " + e.message, { id: toastId });
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div id={`ticket-${team.team_id}`} className="w-full max-w-[320px] overflow-hidden rounded-2xl bg-white shadow-xl mb-4 border border-border/50 text-left">
        {/* Top Section with Background */}
        <div 
          className="bg-[#800020] bg-cover p-6 text-white" 
          style={{ backgroundImage: "url('/mailbk.png')" }}
        >
          {/* Logo */}
          <div className="mb-6 text-center">
            <img 
              src="/diet-code-logo.png" 
              alt="Diet Code Logo" 
              className="mx-auto block h-auto w-full max-w-[150px]" 
            />
          </div>

          {/* Team Info */}
          <div className="mb-1 text-sm text-white/90">Team:</div>
          <div className="mb-6 font-[Impact,Arial_Black,sans-serif] text-2xl font-bold uppercase leading-tight text-white tracking-wide break-words">
            {team.team_name}
          </div>

          {/* Event Info */}
          <div className="mb-6 text-sm leading-relaxed text-white/90">
            September 26, 2026<br />
            9:00 AM<br />
            Srm Ramapuram, MLCP Lab - 6
          </div>

          {/* Team ID */}
          <div className="border-t border-white/30 pt-4 flex justify-between items-end">
            <div>
              <span className="mb-1 block text-xs text-white/80">Team ID</span>
              <span className="block font-mono text-xl font-bold text-[#FFFF00]">
                {team.team_id}
              </span>
            </div>
          </div>
        </div>

        {/* QR Section */}
        <div className="bg-white px-8 py-6 text-center flex flex-col items-center">
          <p className="mb-4 w-full text-left text-xs font-bold uppercase tracking-widest text-black">
          </p>
          {src ? (
            <img 
              src={src} 
              alt={`QR code for ${team.team_name}`} 
              className="block h-auto w-full max-w-[140px] mx-auto" 
            />
          ) : (
            <div className="flex h-[140px] w-[140px] items-center justify-center bg-gray-50 text-sm text-muted-foreground mx-auto">
              Preparing QR…
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full max-w-[320px] gap-2">
        <button
          onClick={() => setEmailOpen(true)}
          className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent bg-background"
        >
          📧 Email
        </button>
        <button
          onClick={() => downloadTicketAsPdf(team.team_id, team.team_name)}
          className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent bg-background"
        >
          PDF
        </button>
        <button
          onClick={() => printQrCard(team).catch(() => toast.error("Print failed."))}
          className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent bg-background"
        >
          Print
        </button>
      </div>
      <EmailConfirmDialog open={emailOpen} teams={[team]} onCancel={() => setEmailOpen(false)} onConfirm={handleEmail} />
    </div>
  );
}
