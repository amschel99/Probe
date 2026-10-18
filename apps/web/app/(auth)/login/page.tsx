"use client";

import { zodResolver } from "@/lib/zod-resolver";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { loginSchema, type LoginInput } from "@repo/services/validators";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message ?? "Login failed");
        return;
      }
      toast.success("Welcome back.");
      router.push(params.get("next") ?? "/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h1 className="display text-2xl font-bold mb-2">Welcome back.</h1>
      <p className="text-probe-700 text-sm mb-6">Steep into your account.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <p className="error">{errors.password.message}</p>}
        </div>
        <button className="btn btn-primary w-full" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-sm text-probe-700 mt-6">
        No account?{" "}
        <Link href="/register" className="text-probe-500 font-semibold">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
