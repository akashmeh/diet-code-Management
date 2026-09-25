import { useQuery } from "@tanstack/react-query";
import { fetchEmailLogs, formatDateTime } from "@/lib/dietcode";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/ui-bits";

export function EmailLogSection() {
  const { data: logs, isLoading, error, refetch } = useQuery({ queryKey: ["emailLogs"], queryFn: fetchEmailLogs });

  if (error) return <ErrorState message={(error as Error).message} />;
  if (isLoading) return <LoadingState />;
  if (!logs?.length) return <EmptyState title="No emails sent" description="Emails you send will appear here." />;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => refetch()}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          Refresh Logs
        </button>
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-caps px-4 py-2.5">Time</th>
                <th className="label-caps px-4 py-2.5">Team</th>
                <th className="label-caps px-4 py-2.5">Recipient</th>
                <th className="label-caps px-4 py-2.5">Status</th>
                <th className="label-caps px-4 py-2.5">Error</th>
                <th className="label-caps px-4 py-2.5">Sent By</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {formatDateTime(log.sent_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">{log.team_id}</span>{" "}
                    {log.team_name}
                  </td>
                  <td className="px-4 py-2.5">{log.recipient_email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide
                      ${log.status === "sent" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" : 
                        log.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400" : 
                        "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400"}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px] truncate text-red-500" title={log.error_message || ""}>
                    {log.error_message || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{log.sent_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
