import Link from "next/link";

import { formatRelative } from "@/lib/utils";

/**
 * The shape of a single item returned by `public.listPublicForms`. The tRPC
 * procedure declares its output as `z.any()`, so we type the slice we actually
 * consume here rather than relying on the (untyped) RouterOutputs inference.
 */
export type ExploreFormItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  responseCount: number;
  publishedAt: string | Date | null;
  theme: {
    slug: string;
    name: string;
    config: {
      background: string;
      surface: string;
      text: string;
      textMuted?: string;
      accent: string;
      accentText: string;
      border: string;
      fontFamily: string;
      logoEmoji?: string;
    } | null;
  } | null;
};

function plural(n: number, word: string) {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

export function ExploreCard({ form }: { form: ExploreFormItem }) {
  const theme = form.theme?.config ?? null;
  const emoji = theme?.logoEmoji ?? "📝";
  const categoryLabel = form.theme?.name ?? "Form";
  const responses = form.responseCount ?? 0;

  // The mini-preview header paints the form's real `background`. The label sits
  // on a `surface`-colored chip because the theme's text color is designed to
  // be read on `surface` (see globals.css [data-probe-form]). Falling back to the
  // app surface/ink tokens keeps AA contrast when a form has no theme.
  const headerStyle: React.CSSProperties = theme
    ? {
        background: theme.background,
        borderBottom: `1px solid ${theme.border}`,
        fontFamily: theme.fontFamily,
      }
    : { background: "var(--color-probe-100)" };

  const titleChipStyle: React.CSSProperties = theme
    ? {
        background: theme.surface,
        color: theme.text,
        border: `1px solid ${theme.border}`,
        fontFamily: theme.fontFamily,
      }
    : {};

  const accentChipStyle: React.CSSProperties = theme
    ? { background: theme.accent, color: theme.accentText }
    : {};

  return (
    <li className="group/card">
      <Link
        href={`/f/${form.slug}`}
        aria-label={`Open form: ${form.title} (${plural(responses, "response")})`}
        className={[
          "card flex h-full flex-col gap-0 overflow-hidden p-0",
          "transition duration-200 will-change-transform",
          "hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(46,33,23,0.45)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-probe-500",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        ].join(" ")}
      >
        {/* Themed mini-preview header — distinct per form theme */}
        <div
          className="relative flex items-center gap-3 px-5 py-5"
          style={headerStyle}
          aria-hidden="true"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] text-2xl shadow-sm"
            style={titleChipStyle}
          >
            {emoji}
          </span>
          <span
            className="min-w-0 flex-1 truncate rounded-[2px] px-3 py-2 text-sm font-semibold shadow-sm"
            style={titleChipStyle}
          >
            {form.title}
          </span>
          <span
            className="absolute right-3 top-3 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            style={accentChipStyle}
          >
            {categoryLabel}
          </span>
        </div>

        {/* Body — uses app chrome tokens for guaranteed AA contrast */}
        <div className="flex flex-1 flex-col gap-2 p-5">
          <h3 className="display text-lg font-bold leading-snug text-probe-900 line-clamp-2">
            {form.title}
          </h3>
          {form.description ? (
            <p className="text-sm text-probe-700 line-clamp-2">{form.description}</p>
          ) : null}

          <dl className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-probe-700">
            <div className="flex items-center gap-1">
              <dt className="sr-only">Responses</dt>
              <dd>{plural(responses, "response")}</dd>
            </div>
            <span aria-hidden="true" className="text-probe-200">
              •
            </span>
            <div className="flex items-center gap-1">
              <dt className="sr-only">Theme</dt>
              <dd>{categoryLabel}</dd>
            </div>
            {form.publishedAt ? (
              <>
                <span aria-hidden="true" className="text-probe-200">
                  •
                </span>
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Published</dt>
                  <dd>{formatRelative(form.publishedAt)}</dd>
                </div>
              </>
            ) : null}
          </dl>

          <div className="mt-auto pt-4">
            <span
              className="btn btn-primary w-full transition group-hover/card:brightness-95"
              aria-hidden="true"
            >
              View / Fill
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover/card:translate-x-0.5 motion-reduce:transition-none"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
