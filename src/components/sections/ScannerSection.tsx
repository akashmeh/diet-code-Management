import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import {
  DuplicateScanError,
  fetchCheckpoints,
  fetchTeams,
  fetchTeamByToken,
  fetchTeamScans,
  formatDateTime,
  memberNames,
  parseQrPayload,
  recordScan,
  type Team,
} from "@/lib/dietcode";
import { cacheTeams, cachedTeams, findCachedTeam, getQueue, isOnline, queueScan, syncQueue } from "@/lib/offline";
import { PageHeader, Panel, StatusPill } from "@/components/ui-bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


const REGION_ID = "dietcode-scanner-region";

export function ScannerSection() {
  const queryClient = useQueryClient();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  const checkpoints = useQuery({ queryKey: ["checkpoints"], queryFn: fetchCheckpoints, enabled: typeof navigator === "undefined" || navigator.onLine });
  const [mode, setMode] = useState<"attendance" | "checkpoint">("attendance");
  const [checkpointId, setCheckpointId] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!checkpointId && checkpoints.data?.length) setCheckpointId(checkpoints.data[0]!.id);
  }, [checkpoints.data, checkpointId]);

  const teamScans = useQuery({
    queryKey: ["team-scans", team?.id],
    queryFn: () => fetchTeamScans(team!.id),
    enabled: Boolean(team),
  });

  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    const refresh = () => setQueued(getQueue().length);
    const doSync = async () => {
      const n = await syncQueue().catch(() => 0);
      refresh();
      if (n > 0) {
        toast.success(`Synced ${n} offline scan${n > 1 ? "s" : ""}.`);
        void queryClient.invalidateQueries();
      }
    };
    const onOnline = () => {
      setOnline(true);
      void doSync();
    };
    const onOffline = () => setOnline(false);
    setOnline(isOnline());
    refresh();
    // warm the offline team cache
    if (isOnline()) {
      fetchTeams().then(cacheTeams).catch(() => undefined);
      void doSync();
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("dietcode-queue", refresh);
    const timer = setInterval(() => void doSync(), 20000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("dietcode-queue", refresh);
      clearInterval(timer);
    };
  }, [queryClient]);

  useEffect(() => {
    return () => {
      const instance = scannerRef.current;
      if (instance) {
        instance.stop().catch(() => undefined);
        scannerRef.current = null;
      }
    };
  }, []);

  async function handleToken(raw: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setScanError(null);
    try {
      const token = parseQrPayload(raw);
      if (!token) {
        setTeam(null);
        setScanError("Invalid QR code — this is not a DIET CODE team pass.");
        return;
      }
      let found: Team | null = null;
      if (isOnline()) {
        try {
          found = await fetchTeamByToken(token);
        } catch {
          found = findCachedTeam(token);
        }
      } else {
        found = findCachedTeam(token);
        if (!found && cachedTeams().length === 0) {
          setTeam(null);
          setScanError("Offline and no saved team list yet. Open this page once while online.");
          return;
        }
      }
      if (!found) {
        setTeam(null);
        setScanError("Invalid QR code — no team matches this token.");
        return;
      }
      setTeam(found);
    } catch (caught) {
      setScanError(caught instanceof Error ? caught.message : "Scan failed.");
    } finally {
      setTimeout(() => {
        busyRef.current = false;
      }, 1200);
    }
  }

  async function startScanner() {
    setCameraError(null);
    try {
      const instance = new Html5Qrcode(REGION_ID, { verbose: false });
      scannerRef.current = instance;
      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => void handleToken(decoded),
        () => undefined,
      );
      setScanning(true);
    } catch {
      scannerRef.current = null;
      setCameraError(
        "Could not open the camera. Allow camera access in your browser, or enter the team ID manually below.",
      );
    }
  }

  async function stopScanner() {
    const instance = scannerRef.current;
    if (instance) {
      await instance.stop().catch(() => undefined);
      instance.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function submitScan(override: boolean) {
    if (!team) return;
    if (!isOnline()) {
      try {
        const at = queueScan({ team, type: mode, checkpointId: mode === "checkpoint" ? checkpointId : null, override });
        if (mode === "attendance" && !team.checked_in_at) setTeam({ ...team, checked_in_at: at });
        toast.success(`Saved offline — ${team.team_name}. Will sync when back online.`);
      } catch (caught) {
        if (caught instanceof DuplicateScanError) setScanError(`${caught.message} Use "Record anyway" to override.`);
        else toast.error("Could not save the scan offline.");
      }
      return;
    }
    try {
      await recordScan({
        team,
        type: mode,
        checkpointId: mode === "checkpoint" ? checkpointId : null,
        override,
      });
      toast.success(
        mode === "attendance"
          ? `${team.team_name} checked in.`
          : `${team.team_name} recorded at ${
              checkpoints.data?.find((c) => c.id === checkpointId)?.name ?? "checkpoint"
            }.`,
      );
      const refreshed = await fetchTeamByToken(team.qr_token);
      setTeam(refreshed);
      await queryClient.invalidateQueries();
    } catch (caught) {
      if (caught instanceof DuplicateScanError) {
        setScanError(`${caught.message} Use "Record anyway" to override.`);
        return;
      }
      toast.error(caught instanceof Error ? caught.message : "Could not record the scan.");
    }
  }

  return (
    <>
      <PageHeader
        title="Scanner"
        description="Point the camera at a team QR pass, then check in or record a checkpoint."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <StatusPill tone={online ? "solid" : "muted"}>{online ? "Online" : "Offline"}</StatusPill>
        {!online && <span className="text-muted-foreground">Scans are saved on this device and sync automatically.</span>}
        {queued > 0 && (
          <span className="font-mono text-xs text-muted-foreground">{queued} scan{queued > 1 ? "s" : ""} waiting to sync</span>
        )}
      </div>

      <div className="max-w-xl">
        <Panel className="px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border">
              {(["attendance", "checkpoint"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`px-3 py-2 text-sm capitalize ${
                    mode === value ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            {mode === "checkpoint" && (
              <select
                value={checkpointId}
                onChange={(e) => setCheckpointId(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              >
                {(checkpoints.data ?? [])
                  .filter((c) => c.is_active)
                  .map((checkpoint) => (
                    <option key={checkpoint.id} value={checkpoint.id}>
                      {checkpoint.name}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <div className="relative mt-5 min-h-[260px] overflow-hidden rounded-md border border-border bg-muted">
            {/* html5-qrcode owns this node — React must never render children inside it */}
            <div id={REGION_ID} className="w-full [&_video]:!w-full [&_video]:!h-auto" />
            {!scanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Camera is off
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            {scanning ? (
              <button
                onClick={() => void stopScanner()}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                Stop camera
              </button>
            ) : (
              <button
                onClick={() => void startScanner()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Start camera
              </button>
            )}
          </div>

          {cameraError && (
            <p className="mt-4 rounded-md border border-foreground px-3 py-2 text-sm">{cameraError}</p>
          )}

          <form
            className="mt-6 border-t border-border pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              const value = manual.trim();
              if (value) void handleToken(value);
            }}
          >
            <label htmlFor="manual" className="label-caps">
              Manual token entry
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="manual"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="DIETCODE:token"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-ring"
              />
              <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                Look up
              </button>
            </div>
          </form>
        </Panel>

      </div>

      <Dialog
        open={Boolean(team || scanError)}
        onOpenChange={(next) => {
          if (!next) {
            setTeam(null);
            setScanError(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Scan result</DialogTitle>
          </DialogHeader>

          {scanError && (
            <p className="rounded-md border border-foreground px-3 py-2 text-sm">{scanError}</p>
          )}


          {team && (
            <div className="mt-4">
              <p className="font-mono text-xs text-muted-foreground">{team.team_id}</p>
              <p className="mt-1 text-lg font-semibold">{team.team_name}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Captain" value={team.captain_name ?? "—"} />
                <Row label="Phone" value={team.captain_phone ?? "—"} />
                <Row label="Members" value={memberNames(team).join(", ") || "—"} />
                <Row label="Department" value={team.department ?? "—"} />
              </dl>
              <div className="mt-4 flex items-center gap-3">
                {team.checked_in_at ? (
                  <>
                    <StatusPill tone="solid">Checked in</StatusPill>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(team.checked_in_at)}
                    </span>
                  </>
                ) : (
                  <StatusPill>Not checked in</StatusPill>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
                <button
                  onClick={() => void submitScan(false)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  {mode === "attendance" ? "Mark Checked In" : "Record checkpoint"}
                </button>
                <button
                  onClick={() => void submitScan(true)}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                >
                  Record anyway (override)
                </button>
                <a
                  href={`/teams/${team.id}`}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                >
                  Open team
                </a>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p className="label-caps">This team's scans</p>
                {(teamScans.data ?? []).length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No scans yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {(teamScans.data ?? []).slice(0, 6).map((scan) => (
                      <li key={scan.id} className="flex justify-between gap-3">
                        <span>{scan.checkpoints?.name ?? "Attendance"}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatDateTime(scan.scanned_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
