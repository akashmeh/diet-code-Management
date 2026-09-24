import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchCheckpoints, fetchScans } from "@/lib/dietcode";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/checkpoints")({
  head: () => ({
    meta: [
      { title: "Checkpoints · DIET CODE Organizer" },
      { name: "description", content: "Create and manage DIET CODE event checkpoints and see scan counts." },
      { property: "og:title", content: "Checkpoints · DIET CODE Organizer" },
      { property: "og:description", content: "Manage DIET CODE checkpoints such as Registration and Final Submission." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckpointsPage,
});

function CheckpointsPage() {
  const queryClient = useQueryClient();
  const checkpoints = useQuery({ queryKey: ["checkpoints"], queryFn: fetchCheckpoints });
  const scans = useQuery({ queryKey: ["scans"], queryFn: () => fetchScans(1000) });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function addCheckpoint(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const position = (checkpoints.data?.length ?? 0) + 1;
      const { error } = await supabase.from("checkpoints").insert({ name: trimmed, position });
      if (error) throw error;
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["checkpoints"] });
      toast.success(`Checkpoint "${trimmed}" created.`);
    } catch (caught) {
      toast.error(
        caught instanceof Error && /duplicate/i.test(caught.message)
          ? "A checkpoint with that name already exists."
          : "Could not create the checkpoint.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    const { error } = await supabase.from("checkpoints").update({ is_active: !isActive }).eq("id", id);
    if (error) {
      toast.error("Could not update the checkpoint.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["checkpoints"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("checkpoints").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete the checkpoint.");
      return;
    }
    await queryClient.invalidateQueries();
    toast.success("Checkpoint deleted.");
  }

  const counts = new Map<string, number>();
  (scans.data ?? []).forEach((scan) => {
    if (scan.scan_type === "checkpoint" && scan.checkpoint_id) {
      counts.set(scan.checkpoint_id, (counts.get(scan.checkpoint_id) ?? 0) + 1);
    }
  });

  return (
    <>
      <PageHeader
        title="Checkpoints"
        description="Every scan records the team, checkpoint, organizer and exact timestamp."
      />

      <Panel className="mb-6 px-5 py-5">
        <form onSubmit={addCheckpoint} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="checkpoint-name" className="label-caps">
              New checkpoint name
            </label>
            <input
              id="checkpoint-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Checkpoint 3"
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <button
            disabled={busy || !name.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Add checkpoint
          </button>
        </form>
      </Panel>

      {checkpoints.error ? (
        <ErrorState message={(checkpoints.error as Error).message} />
      ) : checkpoints.isLoading ? (
        <LoadingState />
      ) : (checkpoints.data ?? []).length === 0 ? (
        <EmptyState title="No checkpoints" description="Add your first checkpoint above." />
      ) : (
        <Panel className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps px-4 py-2.5">#</th>
                <th className="label-caps px-4 py-2.5">Checkpoint</th>
                <th className="label-caps px-4 py-2.5">Status</th>
                <th className="label-caps px-4 py-2.5">Scans</th>
                <th className="label-caps px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(checkpoints.data ?? []).map((checkpoint) => (
                <tr key={checkpoint.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {checkpoint.position}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{checkpoint.name}</td>
                  <td className="px-4 py-2.5">
                    {checkpoint.is_active ? (
                      <StatusPill tone="solid">Active</StatusPill>
                    ) : (
                      <StatusPill>Inactive</StatusPill>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono">{counts.get(checkpoint.id) ?? 0}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <button
                      onClick={() => void toggleActive(checkpoint.id, checkpoint.is_active)}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                    >
                      {checkpoint.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => void remove(checkpoint.id)}
                      className="ml-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}
