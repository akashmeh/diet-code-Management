import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/diet_code_logo.png.asset.json";

// Single shared organizer account; organizers only type the password.
const ORGANIZER_EMAIL = "organizer@dietcode.app";

// The auth client is large — load it lazily so this page renders instantly.
async function getClient() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Organizer sign in · DIET CODE" },
      { name: "description", content: "Sign in to the DIET CODE organizer console by SKETCH." },
      { property: "og:title", content: "Organizer sign in · DIET CODE" },
      { property: "og:description", content: "Organizer access to the DIET CODE event console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClient()
      .then((supabase) => supabase.auth.getSession())
      .then(({ data }) => {
        if (cancelled) return;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = await getClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: ORGANIZER_EMAIL, password });
      if (signInError) throw new Error("Wrong password.");
      navigate({ to: "/dashboard", replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <form onSubmit={submit} className="panel w-full max-w-xs space-y-4 px-6 py-8">
        <img src={logo.url} alt="DIET CODE" className="mx-auto h-20 w-auto" />
        <input
          type="password"
          required
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        {error && <p className="text-center text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Please wait…" : "Enter"}
        </button>
        {checking && (
          <p className="text-center text-xs text-muted-foreground" role="status">
            Checking sign-in…
          </p>
        )}
      </form>
    </div>
  );
}
