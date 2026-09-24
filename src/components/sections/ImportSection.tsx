import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  FIELDS,
  autoMap,
  buildTeams,
  readSheet,
  type FieldKey,
  type Mapping,
  type SheetRow,
} from "@/lib/spreadsheet";
import { PageHeader, Panel } from "@/components/ui-bits";


export function ImportSection() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [idPrefix, setIdPrefix] = useState("DC");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = readSheet(buffer);
      if (!parsed.rows.length) {
        setError("That file has no data rows.");
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMap(parsed.headers));
    } catch {
      setError("Could not read that file. Please upload a valid .xlsx or .csv file.");
    }
  }

  const preview = mapping ? buildTeams(rows, mapping, idPrefix) : null;

  async function importTeams() {
    if (!preview || !preview.teams.length) return;
    setBusy(true);
    setError(null);
    try {
      const seen = new Set<string>();
      const payload = preview.teams
        .filter((team) => {
          if (seen.has(team.team_id)) return false;
          seen.add(team.team_id);
          return true;
        })
        .map((team) => ({ ...team, registration_status: "registered" }));

      const { data, error: upsertError } = await supabase
        .from("teams")
        .upsert(payload, { onConflict: "team_id" })
        .select("id");
      if (upsertError) throw upsertError;

      await queryClient.invalidateQueries();
      toast.success(`${data?.length ?? payload.length} teams imported with QR codes.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Import Teams"
        description="Upload the registration sheet (.xlsx or .csv). A unique QR token is generated for every team automatically."
      />

      <Panel className="px-5 py-6">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-12 text-center"
        >
          <p className="text-sm font-medium">Drop your spreadsheet here</p>
          <p className="mt-1 text-sm text-muted-foreground">.xlsx, .xls or .csv</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Choose file
          </button>
          {fileName && (
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              {fileName} · {rows.length} rows
            </p>
          )}
        </div>
      </Panel>

      {error && (
        <p className="mt-4 rounded-md border border-foreground px-4 py-3 text-sm">{error}</p>
      )}

      {mapping && (
        <>
          <Panel className="mt-6 px-5 py-6">
            <h2 className="text-sm font-semibold">Column mapping</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Detected automatically — adjust any field if your headers differ.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="label-caps" htmlFor={`map-${field.key}`}>
                    {field.label}
                    {field.multi ? " (multi-select)" : ""}
                  </label>
                  <select
                    id={`map-${field.key}`}
                    multiple={field.multi}
                    value={field.multi ? mapping[field.key] : (mapping[field.key]?.[0] ?? "")}
                    onChange={(e) => {
                      const value = field.multi
                        ? Array.from(e.target.selectedOptions).map((o) => o.value)
                        : e.target.value
                          ? [e.target.value]
                          : [];
                      setMapping({ ...mapping, [field.key as FieldKey]: value });
                    }}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    size={field.multi ? 4 : undefined}
                  >
                    {!field.multi && <option value="">— not mapped —</option>}
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-5 max-w-xs">
              <label className="label-caps" htmlFor="prefix">
                Auto Team ID prefix
              </label>
              <input
                id="prefix"
                value={idPrefix}
                onChange={(e) => setIdPrefix(e.target.value.toUpperCase().slice(0, 6))}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used only for rows without a Team ID column.
              </p>
            </div>
          </Panel>

          <Panel className="mt-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">
                Preview · {preview?.teams.length ?? 0} teams
                {preview?.skipped ? ` · ${preview.skipped} rows skipped (no team name)` : ""}
              </h2>
              <button
                onClick={importTeams}
                disabled={busy || !preview?.teams.length}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Importing…" : "Import teams"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-caps px-4 py-2.5">Team ID</th>
                    <th className="label-caps px-4 py-2.5">Team Name</th>
                    <th className="label-caps px-4 py-2.5">Captain</th>
                    <th className="label-caps px-4 py-2.5">Members</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview?.teams ?? []).slice(0, 15).map((team) => (
                    <tr key={team.team_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs">{team.team_id}</td>
                      <td className="px-4 py-2.5">{team.team_name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {team.captain_name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {team.members.map((m) => m.name).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(preview?.teams.length ?? 0) > 15 && (
              <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                Showing first 15 of {preview?.teams.length} teams.
              </p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
