"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signIn, signUp } from "../../lib/auth-client.ts";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 380 }}>
      <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {mode === "signup" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            style={field}
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          style={field}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={8}
          style={field}
        />
        {error && <p style={{ color: "#b3261e", margin: 0 }} role="alert">{error}</p>}
        <button type="submit" disabled={busy} style={{ padding: "10px 14px" }}>
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <p style={{ marginTop: 12, fontSize: ".9rem" }}>
        {mode === "signin" ? "No account? " : "Have an account? "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          style={{ background: "none", border: "none", color: "#3B7A8C", cursor: "pointer", padding: 0 }}
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </main>
  );
}

const field: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #cdd9da",
};
