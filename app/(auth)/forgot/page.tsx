"use client";
import { useState } from "react";
import Link from "next/link";
import { repo } from "@/lib/repo";
import { Button, Field } from "@/components/ui";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter the email you signed up with.");
    setBusy(true);
    setError(null);
    try {
      await repo.sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[400px] card p-6 sm:p-8 rise">
      <p className="text-faint mb-1.5">Password reset</p>
      <h1 className="h2 mb-6">Forgot your password?</h1>
      {sent ? (
        <p className="text-body" role="status">If {email} has an account, a reset link is on its way. It works once and expires in an hour.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Work email" htmlFor="email" hint="We'll email you a link to choose a new password.">
            <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@agency.com" />
          </Field>
          <p role="alert" className="field-error -mt-2">{error}</p>
          <Button type="submit" variant="primary" size="large" loading={busy} className="w-full">Send reset link</Button>
        </form>
      )}
      <p className="text-muted mt-6 text-center"><Link href="/login" className="text-ink font-medium">Back to log in</Link></p>
    </div>
  );
}
