import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DIET CODE Organizer Console · SKETCH" },
      {
        name: "description",
        content:
          "Organizer console for DIET CODE by SKETCH: team import, QR passes, attendance and checkpoint scanning.",
      },
      { property: "og:title", content: "DIET CODE Organizer Console" },
      {
        property: "og:description",
        content: "Internal organizer console for DIET CODE team check-in and checkpoint tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="panel w-full max-w-md px-8 py-10 text-center">
        <p className="font-mono text-xl tracking-[0.25em] text-foreground">DIET CODE</p>
        <p className="mt-2 text-sm text-muted-foreground">SKETCH</p>
        <div className="my-7 border-t border-border" />
        <h1 className="text-lg font-semibold text-foreground">Organizer Console</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Team import, QR passes, attendance and checkpoint tracking. Organizer access only.
        </p>
        <Link
          to="/auth"
          className="mt-7 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
