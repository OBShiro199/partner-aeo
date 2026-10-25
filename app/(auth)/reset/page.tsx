"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { repo } from "@/lib/repo";
import { useApp } from "@/lib/store";
import { Button, Field } from "@/components/ui";

// The reset email's link signs the person in for this one purpose, then lands here.
export default function ResetPage() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Give the auth client a moment to read the token from the link.
    const t = setTimeout(async () => setReady(!!(await repo.currentUser())), 600);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    setError(null);
    try {
      await repo.updatePassword(password);
      await useApp.getState().refresh();
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[400px] card p-6 sm:p-8 rise">
      <p className="text-faint mb-1.5">Password reset</p>
      <h1 className="h2 mb-6">Choose a new password</h1>
      {ready === null ? (
        <div className="flex items-center gap-3 text-faint"><span className="spinner" /> Checking your link</div>
      ) : !ready ? (
        <>
          <p className="text-body">This reset link has expired or was already used. Ask for a new one.</p>
          <Link href="/forgot" className="btn btn-primary mt-6 w-full">Send a new link</Link>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="New password" htmlFor="password" hint="At least 8 characters.">
            <input id="password" type="password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Field>
          <p role="alert" className="field-error -mt-2">{error}</p>
          <Button type="submit" variant="primary" size="large" loading={busy} className="w-full">Save and continue</Button>
        </form>
      )}
    </div>
  );
}
