import * as XLSX from "xlsx";

export type SheetRow = Record<string, unknown>;

export type FieldKey =
  | "team_id"
  | "team_name"
  | "captain_name"
  | "captain_email"
  | "captain_phone"
  | "department"
  | "register_number"
  | "team_size"
  | "members";

export const FIELDS: { key: FieldKey; label: string; required?: boolean; multi?: boolean }[] = [
  { key: "team_id", label: "Team ID" },
  { key: "team_name", label: "Team Name", required: true },
  { key: "captain_name", label: "Captain Name" },
  { key: "captain_email", label: "Captain Email" },
  { key: "captain_phone", label: "Captain Phone" },
  { key: "department", label: "Department" },
  { key: "register_number", label: "Register Number" },
  { key: "team_size", label: "Team Size" },
  { key: "members", label: "Member Names", multi: true },
];

const PATTERNS: Record<FieldKey, RegExp[]> = {
  team_id: [/^team\s*id$/i, /^id$/i, /^team\s*code$/i],
  team_name: [/team\s*name/i, /^team$/i],
  captain_name: [/team\s*leader\s*name/i, /captain\s*name/i, /leader/i, /captain/i],
  captain_email: [/leader.*mail/i, /captain.*mail/i, /^srm\s*email/i, /e-?mail/i],
  captain_phone: [/leader.*phone/i, /captain.*phone/i, /phone|mobile|contact/i],
  department: [/department|branch/i],
  register_number: [/register\s*number|reg\s*no|roll/i],
  team_size: [/team\s*size|size|no\.?\s*of\s*members/i],
  members: [/member\s*\d*\s*name/i, /^members?$/i, /member\s*names/i],
};

export function readSheet(buffer: ArrayBuffer): { headers: string[]; rows: SheetRow[] } {
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: null, raw: false });
  const headerMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });
  const headers = ((headerMatrix[0] ?? []) as unknown[])
    .map((h) => String(h ?? "").trim())
    .filter(Boolean);
  return { headers, rows };
}

export type Mapping = Record<FieldKey, string[]>;

export function autoMap(headers: string[]): Mapping {
  const mapping = {} as Mapping;
  for (const field of FIELDS) {
    const matches = headers.filter((h) => PATTERNS[field.key].some((p) => p.test(h.trim())));
    mapping[field.key] = field.multi ? matches : matches.slice(0, 1);
  }
  return mapping;
}

const str = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

export type ParsedTeam = {
  team_id: string;
  team_name: string;
  captain_name: string | null;
  captain_email: string | null;
  captain_phone: string | null;
  department: string | null;
  register_number: string | null;
  team_size: number | null;
  members: { name: string; phone?: string | null; email?: string | null }[];
};

export function buildTeams(
  rows: SheetRow[],
  mapping: Mapping,
  idPrefix = "DC",
): { teams: ParsedTeam[]; skipped: number } {
  const teams: ParsedTeam[] = [];
  let skipped = 0;
  let counter = 0;

  rows.forEach((row) => {
    const pick = (key: FieldKey) => {
      const col = mapping[key]?.[0];
      return col ? str(row[col]) : null;
    };
    const teamName = pick("team_name");
    if (!teamName) {
      skipped += 1;
      return;
    }
    counter += 1;
    const members = (mapping.members ?? [])
      .map((col) => str(row[col]))
      .filter((name): name is string => Boolean(name))
      .map((name) => ({ name }));

    const sizeRaw = pick("team_size");
    const parsedSize = sizeRaw ? Number.parseInt(sizeRaw, 10) : NaN;

    teams.push({
      team_id: pick("team_id") ?? `${idPrefix}${String(counter).padStart(3, "0")}`,
      team_name: teamName,
      captain_name: pick("captain_name"),
      captain_email: pick("captain_email"),
      captain_phone: pick("captain_phone"),
      department: pick("department"),
      register_number: pick("register_number"),
      team_size: Number.isFinite(parsedSize) ? parsedSize : null,
      members,
    });
  });

  return { teams, skipped };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join(
    "\n",
  );
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}

export function downloadXlsx(filename: string, rows: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Data");
  const output = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  triggerDownload(
    new Blob([output], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
