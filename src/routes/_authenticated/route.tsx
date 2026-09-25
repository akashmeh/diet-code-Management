import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
});
