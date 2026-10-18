import Link from "next/link";

export default function FormNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-probe-50 p-6">
      <div className="card text-center max-w-md">
        <div className="text-3xl mb-4">🫖</div>
        <h1 className="display text-2xl font-bold">Form not found</h1>
        <p className="text-probe-700 mt-2">
          Either this form doesn&apos;t exist or it&apos;s not published yet.
        </p>
        <Link href="/" className="btn btn-primary mt-4 inline-block">
          Back to Probe
        </Link>
      </div>
    </div>
  );
}
