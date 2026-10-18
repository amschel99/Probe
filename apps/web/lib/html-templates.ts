/**
 * Downloadable HTML page templates with the Probe endpoint (`/submit`) form
 * pre-wired. The actual files live in `public/form-templates/<slug>.html` — this
 * module is just the gallery metadata. Anyone can download them for free; they
 * only need to generate an access key (Dashboard → Endpoint Forms) to go live.
 */

export interface HtmlTemplate {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  /** Fields the embedded form collects (for the gallery card). */
  fields: string[];
}

export const HTML_TEMPLATES: HtmlTemplate[] = [
  {
    slug: "contact",
    name: "Contact page",
    emoji: "✉️",
    description: "A clean, centered contact form. The classic “get in touch” page for any site.",
    fields: ["Name", "Email", "Message"],
  },
  {
    slug: "newsletter",
    name: "Newsletter signup",
    emoji: "📬",
    description: "A bold, dark single-field email capture. Drop it in a footer or hero.",
    fields: ["Email"],
  },
  {
    slug: "waitlist",
    name: "Waitlist / early access",
    emoji: "🚀",
    description: "Collect early-access signups with an optional “what for?” prompt.",
    fields: ["Name", "Work email", "Use case"],
  },
  {
    slug: "feedback",
    name: "Feedback widget",
    emoji: "💬",
    description: "A star rating plus a message box. Great for post-launch feedback.",
    fields: ["Star rating", "Message", "Email (optional)"],
  },
];

/** Public path to a template's downloadable HTML file. */
export function templateFilePath(slug: string) {
  return `/form-templates/${slug}.html`;
}
