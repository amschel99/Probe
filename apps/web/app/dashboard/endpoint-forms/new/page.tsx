"use client";

import { zodResolver } from "@/lib/zod-resolver";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createEndpointFormSchema,
  type CreateEndpointFormInput,
} from "@repo/services/validators";

import { trpc } from "@/lib/trpc";

export default function NewEndpointFormPage() {
  const router = useRouter();
  const create = trpc.endpoint.create.useMutation({
    onSuccess: (form) => {
      toast.success("Endpoint created. Check your email to verify.");
      router.push(`/dashboard/endpoint-forms/${form.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEndpointFormInput>({
    resolver: zodResolver(createEndpointFormSchema),
  });

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="display text-3xl font-bold">New endpoint form</h1>
        <p className="text-probe-700">
          Two fields. You&apos;ll get an access key and a verification email — submissions only
          start delivering after you click the link.
        </p>
      </div>

      <form className="card space-y-4" onSubmit={handleSubmit((v) => create.mutate(v))}>
        <div>
          <label className="label">Form name</label>
          <input
            className="input"
            placeholder="Acme Co. — Contact form"
            {...register("title")}
          />
          {errors.title && <p className="error">{errors.title.message}</p>}
        </div>

        <div>
          <label className="label">Your website</label>
          <input
            className="input"
            placeholder="https://acme.example"
            {...register("websiteUrl")}
          />
          <p className="help">
            Submissions are only accepted from this origin. You can add more later.
          </p>
          {errors.websiteUrl && <p className="error">{errors.websiteUrl.message}</p>}
        </div>

        <div>
          <label className="label">Recipient email (optional)</label>
          <input
            className="input"
            type="email"
            placeholder="Defaults to your account email"
            {...register("recipientEmail")}
          />
          {errors.recipientEmail && (
            <p className="error">{errors.recipientEmail.message}</p>
          )}
        </div>

        <button className="btn btn-primary" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create endpoint"}
        </button>
      </form>
    </div>
  );
}
