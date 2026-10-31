"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: "/reset-password",
        }),
      });
      if (res.status === 429) {
        toast.error("Too many attempts. Wait a minute and try again.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message ?? "Something went wrong. Try again.");
        return;
      }
      // Same message whether or not the account exists.
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="card">
        <h1 className="display mb-2 text-4xl">Check your inbox.</h1>
        <p className="text-sm text-probe-700">
          If an account exists for <strong className="text-probe-900">{email}</strong>, we&apos;ve
          sent a link to reset its password. It expires in 1 hour.
        </p>
        <p className="mt-4 text-sm text-probe-700">
          Nothing after a few minutes? Check spam, or{" "}
          <button type="button" className="text-probe-500 underline" onClick={() => setSent(false)}>
            try again
          </button>
          .
        </p>
        <p className="mt-6 text-sm">
          <Link href="/login" className="font-semibold text-probe-500">
            Back to log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="display mb-2 text-4xl">Forgot your password?</h1>
      <p className="mb-6 text-sm text-probe-700">
        Enter your account email and we&apos;ll send you a link to choose a new one.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button className="btn btn-primary w-full" disabled={submitting || !email.includes("@")}>
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-sm text-probe-700">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-probe-500">
          Log in
        </Link>
      </p>
    </div>
  );
}
