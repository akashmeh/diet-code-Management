import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Organizer sign in · DIET CODE" },
      {
        name: "description",
        content: "Sign in to the DIET CODE organizer console for SKETCH, SRM Ramapuram.",
      },
      { property: "og:title", content: "Organizer sign in · DIET CODE" },
      { property: "og:description", content: "Organizer access to the DIET CODE event console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        setMessage("Check your inbox to confirm the organizer account, then sign in.");
        setMode("signin");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="panel w-full max-w-sm px-7 py-9">
        <p className="font-mono text-base tracking-[0.25em] text-foreground">DIET CODE</p>
        <h1 className="mt-5 text-lg font-semibold text-foreground">
          {mode === "signin" ? "Organizer sign in" : "Create organizer account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Restricted to event organizers.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="label-caps">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label htmlFor="password" className="label-caps">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>

          {error && <p className="rounded-md border border-foreground px-3 py-2 text-sm">{error}</p>}
          {message && (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setMessage(null);
          }}
          className="mt-5 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "signin" ? "Need an organizer account?" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
