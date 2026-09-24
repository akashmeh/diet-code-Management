import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import logo from "@/assets/diet_code_logo.png";

const NAV = [
  { to: "/dashboard", label: "Event" },
  { to: "/checkpoints", label: "Checkpoints" },
  { to: "/scan-history", label: "Scan History" },
  { to: "/export", label: "Export" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 lg:px-8">
          <img src={logo} alt="DIET CODE" className="h-9 w-auto" />
          <nav className="flex flex-wrap gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  pathname === item.to ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button onClick={signOut} className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
