"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  // The emailed link goes through /api/auth/reset-password/:token, which
  // redirects here with ?token=… (or ?error=INVALID_TOKEN if it's bad/expired).
  const token = params.get("token");
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (linkError || !token) {
    return (
      <div className="card">
        <h1 className="display mb-2 text-3xl">This link doesn&apos;t work.</h1>
        <p className="text-sm text-probe-700">
          Reset links expire after an hour and can only be used once. Ask for a new one.
        </p>
        <Link href="/forgot-password" className="btn btn-primary mt-6 w-full">
          Send a new link
        </Link>
      </div>
    );
  }

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8 || password !== confirm) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: password, token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          data?.code === "INVALID_TOKEN"
            ? "This link has expired. Ask for a new one."
            : (data?.message ?? "Couldn't reset the password. Try again."),
        );
        return;
      }
      toast.success("Password updated. Log in with your new password.");
      router.push("/login");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h1 className="display mb-2 text-3xl">Choose a new password.</h1>
      <p className="mb-6 text-sm text-probe-700">
        At least 8 characters. You&apos;ll be signed out everywhere else.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {tooShort && <p className="error">Use at least 8 characters.</p>}
        </div>
        <div>
          <label className="label" htmlFor="confirm">
            Confirm new password
          </label>
          <input
            id="confirm"
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && <p className="error">The passwords don&apos;t match.</p>}
        </div>
        <button
          className="btn btn-primary w-full"
          disabled={submitting || password.length < 8 || password !== confirm}
        >
          {submitting ? "Saving…" : "Set new password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
