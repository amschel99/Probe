"use client";

import { zodResolver } from "@/lib/zod-resolver";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { registerSchema, type RegisterInput } from "@repo/services/validators";

export default function RegisterPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message ?? "Sign up failed");
        return;
      }
      toast.success("Account created. Brewing your dashboard…");
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h1 className="display text-2xl font-bold mb-2">Make an account.</h1>
      <p className="text-probe-700 text-sm mb-6">Takes 5 seconds. No credit card. Honest.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Your name</label>
          <input className="input" autoComplete="name" {...register("name")} />
          {errors.name && <p className="error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="error">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <p className="error">{errors.password.message}</p>}
        </div>
        <button className="btn btn-primary w-full" disabled={submitting}>
          {submitting ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="text-sm text-probe-700 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-probe-500 font-semibold">
          Log in
        </Link>
      </p>
    </div>
  );
}
