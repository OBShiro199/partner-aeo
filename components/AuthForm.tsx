"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { repo, isDemo } from "@/lib/repo";
import { useApp } from "@/lib/store";
import { Button, Field } from "./ui";
import { Gate } from "./gate";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const refresh = useApp((s) => s.refresh);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    try {
      if (mode === "signup") {
        const r = await repo.signUp(email.trim(), password, name.trim());
        if (r.needsConfirmation) { setNotice(`Check ${email} for a confirmation link, then log in.`); return; }
      } else {
        await repo.signIn(email.trim(), password);
      }
      await refresh();
      router.replace(useApp.getState().status === "ready" ? "/dashboard" : "/onboarding");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Gate need="anon">
      <div className="w-full max-w-[400px] card p-6 sm:p-8 rise" style={{ boxShadow: "0 1px 2px rgba(8,9,10,.04)" }}>
        <p className="text-faint mb-1.5">{mode === "signup" ? "Start a 14-day trial" : "Welcome back"}</p>
        <h1 className="h2 mb-6">{mode === "signup" ? "Create your agency workspace" : "Log in to Partner AEO"}</h1>
        {notice ? (
          <p className="text-body" role="status">{notice}</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {mode === "signup" && (
              <Field label="Your name" htmlFor="name">
                <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" />
              </Field>
            )}
            <Field label="Work email" htmlFor="email">
              <input id="email" type="email" required className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@agency.com" />
            </Field>
            <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
              <input id="password" type="password" required className="input" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <p role="alert" className="field-error -mt-2">{error}</p>
            <Button type="submit" variant="primary" size="large" loading={busy} className="w-full">
              {mode === "signup" ? "Create workspace" : "Log in"}
            </Button>
          </form>
        )}
        <p className="text-muted mt-6 text-center">
          {mode === "signup" ? <>Already have an account? <Link href="/login" className="text-ink font-medium">Log in</Link></> : <>New here? <Link href="/signup" className="text-ink font-medium">Create a workspace</Link></>}
        </p>
        {isDemo && <p className="text-faint mt-4 text-center t-12">Demo mode: accounts live in this browser only.</p>}
      </div>
    </Gate>
  );
}
