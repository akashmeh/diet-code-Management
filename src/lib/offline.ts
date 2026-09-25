import { supabase } from "@/integrations/supabase/client";
import { DuplicateScanError, type Team } from "@/lib/dietcode";

const TEAMS_KEY = "dietcode.teams.cache";
const QUEUE_KEY = "dietcode.scan.queue";

export type QueuedScan = {
  id: string;
  team_uuid: string;
  team_id: string;
  team_name: string;
  scan_type: "attendance" | "checkpoint";
  checkpoint_id: string | null;
  checkpoint_name?: string | null;
  is_override: boolean;
  scanned_at: string;
};

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function cacheTeams(teams: Team[]) {
  try {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
  } catch {
    /* storage full */
  }
}

export function cachedTeams(): Team[] {
  try {
    return JSON.parse(localStorage.getItem(TEAMS_KEY) ?? "[]") as Team[];
  } catch {
    return [];
  }
}

export function findCachedTeam(token: string) {
  return cachedTeams().find((t) => t.qr_token === token) ?? null;
}

export function getQueue(): QueuedScan[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedScan[];
  } catch {
    return [];
  }
}

function setQueue(queue: QueuedScan[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event("dietcode-queue"));
}

export function queueScan(input: {
  team: Team;
  type: "attendance" | "checkpoint";
  checkpointId: string | null;
  checkpointName?: string | null;
  override: boolean;
}) {
  const queue = getQueue();
  if (!input.override) {
    const dup =
      input.type === "attendance"
        ? Boolean(input.team.checked_in_at) ||
          queue.some((q) => q.team_uuid === input.team.id && q.scan_type === "attendance" && !q.is_override)
        : queue.some(
            (q) =>
              q.team_uuid === input.team.id &&
              q.scan_type === "checkpoint" &&
              q.checkpoint_id === input.checkpointId &&
              !q.is_override,
          );
    if (dup) {
      throw new DuplicateScanError(
        input.type === "attendance" ? "This team is already checked in." : "This team already has this checkpoint recorded.",
      );
    }
  }
  const scannedAt = new Date().toISOString();
  queue.push({
    id: crypto.randomUUID(),
    team_uuid: input.team.id,
    team_id: input.team.team_id,
    team_name: input.team.team_name,
    scan_type: input.type,
    checkpoint_id: input.checkpointId,
    checkpoint_name: input.checkpointName ?? null,
    is_override: input.override,
    scanned_at: scannedAt,
  });
  setQueue(queue);
  if (input.type === "attendance") {
    cacheTeams(
      cachedTeams().map((t) => (t.id === input.team.id && !t.checked_in_at ? { ...t, checked_in_at: scannedAt } : t)),
    );
  }
  return scannedAt;
}

let syncing = false;
/** Pushes queued offline scans to the database. Returns number synced. */
export async function syncQueue(): Promise<number> {
  if (syncing || !isOnline()) return 0;
  const queue = getQueue();
  if (!queue.length) return 0;
  syncing = true;
  let synced = 0;
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return 0;
    const remaining: QueuedScan[] = [];
    for (const item of queue) {
      const { error } = await supabase.from("scans").insert({
        team_uuid: item.team_uuid,
        checkpoint_id: item.checkpoint_id,
        scan_type: item.scan_type,
        organizer_id: user.id,
        organizer_email: user.email ?? null,
        is_override: item.is_override,
        scanned_at: item.scanned_at,
      });
      const duplicate = error && (error.code === "23505" || /duplicate key/i.test(error.message));
      if (error && !duplicate) {
        remaining.push(item);
        continue;
      }
      if (item.scan_type === "attendance") {
        await supabase
          .from("teams")
          .update({ checked_in_at: item.scanned_at })
          .eq("id", item.team_uuid)
          .is("checked_in_at", null);
      }
      synced++;
    }
    setQueue(remaining);
  } finally {
    syncing = false;
  }
  return synced;
}
