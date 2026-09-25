import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import logo from "@/assets/diet_code_logo.png";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/dashboard", replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="panel w-full max-w-xs space-y-4 px-6 py-8 text-center">
        <img src={logo} alt="DIET CODE" className="mx-auto h-20 w-auto" />
        <p className="text-sm text-muted-foreground mt-4">Entering console...</p>
      </div>
    </div>
  );
}
