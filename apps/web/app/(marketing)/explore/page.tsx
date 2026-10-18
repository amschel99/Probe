import Link from "next/link";

import { api } from "@/lib/trpc-server";

import { ExploreCard, type ExploreFormItem } from "./_components/explore-card";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q?.trim() ?? "";
  let items: ExploreFormItem[] = [];
  try {
    const res = await api.public.listPublicForms.query({
      limit: 24,
      search: searchParams.q,
    });
    items = (res.items ?? []) as ExploreFormItem[];
  } catch {
    // DB not configured — render empty state
  }

  const hasSearch = query.length > 0;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="display text-4xl font-bold text-probe-900">Explore</h1>
          <p className="mt-2 max-w-xl text-probe-700">
            Public forms built by the community — each one wears its own theme.
            Open-source vibes, public visibility.
          </p>
        </div>
        <form
          role="search"
          aria-label="Search public forms"
          className="flex w-full gap-2 md:w-auto"
        >
          <label htmlFor="explore-search" className="sr-only">
            Search public forms
          </label>
          <input
            id="explore-search"
            name="q"
            type="search"
            defaultValue={searchParams.q}
            placeholder="Search forms…"
            className="input md:w-64"
          />
          <button type="submit" className="btn btn-ghost shrink-0">
            Search
          </button>
        </form>
      </div>

      {items.length > 0 ? (
        <>
          <p className="mt-8 text-sm text-probe-700" aria-live="polite">
            {hasSearch ? (
              <>
                Showing <strong className="text-probe-900">{items.length}</strong>{" "}
                {items.length === 1 ? "result" : "results"} for{" "}
                <span className="text-probe-900">&ldquo;{query}&rdquo;</span>
              </>
            ) : (
              <>
                <strong className="text-probe-900">{items.length}</strong> public{" "}
                {items.length === 1 ? "form" : "forms"}
              </>
            )}
          </p>
          <ul
            role="list"
            aria-label="Public forms"
            className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((form) => (
              <ExploreCard key={form.id} form={form} />
            ))}
          </ul>
        </>
      ) : (
        <div className="card mt-8 flex flex-col items-center gap-3 py-16 text-center">
          <div className="text-4xl" aria-hidden="true">
            🫖
          </div>
          {hasSearch ? (
            <>
              <p className="text-probe-900">
                No public forms match{" "}
                <span className="font-semibold">&ldquo;{query}&rdquo;</span>.
              </p>
              <p className="text-sm text-probe-700">
                Try a different search, or{" "}
                <Link href="/explore" className="text-probe-500 underline underline-offset-2">
                  browse all forms
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <p className="text-probe-900">No public forms yet.</p>
              <p className="text-sm text-probe-700">
                Be the first —{" "}
                <Link href="/register" className="text-probe-500 underline underline-offset-2">
                  build a form
                </Link>{" "}
                and publish it for everyone.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
