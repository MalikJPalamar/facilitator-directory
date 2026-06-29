"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { signIn, signUp } from "../../lib/auth-client.ts";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Open in signup mode when linked as /login?mode=signup (e.g. "Create your
  // school" CTAs); default to signin otherwise.
  const initialMode =
    searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      mode === "signin"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "Something went wrong");
      return;
    }
    // Honour ?next= (claim links send signed-out users here first), but only a
    // same-origin relative path — never an absolute/protocol-relative redirect.
    const next = searchParams.get("next");
    const dest =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="page" style={{ maxWidth: 440 }}>
      <div className="panel">
        <h1 style={{ fontSize: "var(--fs-h2)" }}>
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <form onSubmit={onSubmit} className="stack" style={{ gap: "var(--space-3)" }}>
          {mode === "signup" && (
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <p style={{ color: "#b3261e", margin: 0, fontSize: "var(--fs-sm)" }} role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary btn-block">
            {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>
        <p style={{ marginBottom: 0, marginTop: "var(--space-4)", fontSize: "var(--fs-sm)" }}>
          {mode === "signin" ? "No account? " : "Have an account? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            style={{ background: "none", border: "none", color: "var(--color-accent)", cursor: "pointer", padding: 0, font: "inherit" }}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

/**
 * useSearchParams() requires a Suspense boundary in the App Router, so the
 * client form lives in LoginForm and the page wraps it. The fallback mirrors the
 * panel shell so there's no layout shift before the params resolve.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="page" style={{ maxWidth: 440 }}>
          <div className="panel" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
