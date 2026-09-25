import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/ui-bits";

type AddTeamFormData = {
  team_id: string;
  team_name: string;
  captain_name: string;
  captain_email: string;
  captain_phone: string;
  department: string;
  register_number: string;
  team_size: number;
};

export function AddTeamSection() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddTeamFormData>();

  async function onSubmit(data: AddTeamFormData) {
    setBusy(true);
    try {
      const payload = {
        team_id: data.team_id,
        team_name: data.team_name,
        captain_name: data.captain_name || null,
        captain_email: data.captain_email || null,
        captain_phone: data.captain_phone || null,
        department: data.department || null,
        register_number: data.register_number || null,
        team_size: data.team_size ? Number(data.team_size) : null,
        registration_status: "registered",
      };

      const { error } = await supabase.from("teams").insert(payload);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success(`Team ${data.team_name} added successfully!`);
      reset();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add team.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Add Team Manually"
        description="Add a single team directly without importing a spreadsheet."
      />

      <Panel className="px-5 py-6 mt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-caps mb-1.5 block">Team ID *</label>
              <input
                {...register("team_id", { required: "Team ID is required" })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                placeholder="e.g. DC001"
              />
              {errors.team_id && <p className="mt-1 text-xs text-red-500">{errors.team_id.message}</p>}
            </div>
            
            <div>
              <label className="label-caps mb-1.5 block">Team Name *</label>
              <input
                {...register("team_name", { required: "Team name is required" })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                placeholder="Team Name"
              />
              {errors.team_name && <p className="mt-1 text-xs text-red-500">{errors.team_name.message}</p>}
            </div>

            <div>
              <label className="label-caps mb-1.5 block">Captain Name</label>
              <input
                {...register("captain_name")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="label-caps mb-1.5 block">Captain Email</label>
              <input
                type="email"
                {...register("captain_email")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="label-caps mb-1.5 block">Captain Phone</label>
              <input
                {...register("captain_phone")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="label-caps mb-1.5 block">Department</label>
              <input
                {...register("department")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="label-caps mb-1.5 block">Register Number</label>
              <input
                {...register("register_number")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="label-caps mb-1.5 block">Team Size</label>
              <input
                type="number"
                {...register("team_size")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Adding..." : "Add Team"}
            </button>
          </div>
        </form>
      </Panel>
    </>
  );
}
