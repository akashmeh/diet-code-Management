import { supabase } from "@/integrations/supabase/client";

export const QR_PREFIX = "DIETCODE:";

export type Team = {
  id: string;
  team_id: string;
  team_name: string;
  captain_name: string | null;
  captain_email: string | null;
  captain_phone: string | null;
  department: string | null;
  register_number: string | null;
  team_size: number | null;
  members: { name: string; phone?: string | null; email?: string | null }[];
  registration_status: string;
  qr_token: string;
  checked_in_at: string | null;
  created_at: string;
};

export type Checkpoint = {
  id: string;
  name: string;
  position: number;
  is_active: boolean;
};

export type Scan = {
  id: string;
  team_uuid: string;
  checkpoint_id: string | null;
  scan_type: "attendance" | "checkpoint";
  organizer_email: string | null;
  is_override: boolean;
  scanned_at: string;
  teams?: { team_id: string; team_name: string } | null;
  checkpoints?: { name: string } | null;
};

export function qrPayload(token: string) {
  return `${QR_PREFIX}${token}`;
}

export function parseQrPayload(raw: string): string | null {
  const value = raw.trim();
  if (value.startsWith(QR_PREFIX)) {
    const token = value.slice(QR_PREFIX.length).trim();
    return /^[a-zA-Z0-9_-]{8,}$/.test(token) ? token : null;
  }
  // Also accept a full URL form ending in /t/<token>
  const match = value.match(/\/t\/([a-zA-Z0-9_-]{8,})$/);
  return match ? match[1]! : null;
}

export async function fetchTeams() {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("team_id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Team[];
}

export async function fetchTeamByToken(token: string) {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("qr_token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Team) ?? null;
}

export async function fetchCheckpoints() {
  const { data, error } = await supabase
    .from("checkpoints")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Checkpoint[];
}

export async function fetchScans(limit = 500) {
  const { data, error } = await supabase
    .from("scans")
    .select("*, teams(team_id, team_name), checkpoints(name)")
    .order("scanned_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as Scan[];
}

export async function fetchTeamScans(teamUuid: string) {
  const { data, error } = await supabase
    .from("scans")
    .select("*, checkpoints(name)")
    .eq("team_uuid", teamUuid)
    .order("scanned_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Scan[];
}

export type RecordScanInput = {
  team: Team;
  type: "attendance" | "checkpoint";
  checkpointId?: string | null;
  override?: boolean;
};

/** Records a scan. Duplicates are blocked by unique database indexes. */
export async function recordScan({ team, type, checkpointId, override }: RecordScanInput) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("You are signed out. Please sign in again.");
  if (type === "checkpoint" && !checkpointId) throw new Error("Select a checkpoint first.");

  const { error } = await supabase.from("scans").insert({
    team_uuid: team.id,
    checkpoint_id: type === "checkpoint" ? checkpointId! : null,
    scan_type: type,
    organizer_id: user.id,
    organizer_email: user.email ?? null,
    is_override: Boolean(override),
  });

  if (error) {
    if (error.code === "23505" || error.code === "23514" || /duplicate key/i.test(error.message)) {
      throw new DuplicateScanError(
        type === "attendance"
          ? "This team is already checked in."
          : "This team already has this checkpoint recorded.",
      );
    }
    throw error;
  }

  if (type === "attendance") {
    const { error: updateError } = await supabase
      .from("teams")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", team.id)
      .is("checked_in_at", null);
    if (updateError) throw updateError;
  }
}

export class DuplicateScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateScanError";
  }
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function memberNames(team: Team) {
  return (team.members ?? []).map((m) => m.name).filter(Boolean);
}

/** Manually mark a team present (now) or absent. Absent also clears attendance scans so the QR can be scanned again. */
export async function setTeamPresent(teamId: string, present: boolean) {
  if (!present) {
    const { error: delError } = await supabase
      .from("scans")
      .delete()
      .eq("team_uuid", teamId)
      .eq("scan_type", "attendance");
    if (delError) throw delError;
  }
  const { error } = await supabase
    .from("teams")
    .update({ checked_in_at: present ? new Date().toISOString() : null })
    .eq("id", teamId);
  if (error) throw error;
}

export async function deleteTeam(teamId: string) {
  // Delete related scans first to avoid foreign key constraint errors if cascade delete is not setup
  const { error: scansError } = await supabase.from("scans").delete().eq("team_uuid", teamId);
  if (scansError) throw scansError;

  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw error;
}
