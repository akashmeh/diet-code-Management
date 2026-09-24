import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("panel", className)}>{children}</div>;
}

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="panel px-4 py-4">
      <p className="label-caps">{label}</p>
      <p className="mt-2 font-mono text-3xl font-medium text-foreground">{value}</p>
    </div>
  );
}

export function StatusPill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "solid" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider",
        tone === "solid"
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="panel px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="panel px-6 py-14 text-center text-sm text-muted-foreground">{label}</div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="panel border-foreground px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">Something went wrong</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
