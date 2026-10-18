import Link from "next/link";

export const metadata = {
  title: "Pricing — Probe",
  description: "Probe is free and open source. Everything included, forever.",
};

const TIERS = [
  {
    name: "Hosted",
    price: "₹0",
    cadence: "forever",
    emoji: "🔎",
    blurb: "The instance you're looking at right now. Sign up and start building.",
    cta: { label: "Get started", href: "/register" },
    highlight: true,
    perks: [
      "Unlimited forms & responses",
      "All 10 themes + theme gallery",
      "Conditional logic & multi-page forms",
      "CSV / Excel / PDF export",
      "Password protection & custom slugs",
      "QR sharing & analytics dashboards",
    ],
  },
  {
    name: "Self-host",
    price: "₹0",
    cadence: "your server",
    emoji: "🐳",
    blurb: "One Docker image, one Kamal service. Own your data end to end.",
    cta: { label: "Read the docs", href: "/docs" },
    highlight: false,
    perks: [
      "Everything in Hosted",
      "Ships as a single container",
      "Deploy with Kamal in minutes",
      "Bring your own Postgres",
      "API endpoint forms + signed webhooks",
      "MIT licensed — fork it freely",
    ],
  },
  {
    name: "Tip jar",
    price: "Any",
    cadence: "one-time, optional",
    emoji: "☕",
    blurb: "Nothing unlocks. It just says thanks.",
    cta: { label: "Send a tip", href: "/open-source" },
    highlight: false,
    perks: [
      "A warm fuzzy feeling",
      "Genuine gratitude",
      "Zero feature gates",
      "No card stored",
      "No login required",
      "Still 100% open source",
    ],
  },
];

export default function PricingPage() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="display text-5xl font-bold text-probe-900">
          One price. It&apos;s free.
        </h1>
        <p className="text-lg text-probe-700 mt-6">
          Google Forms is free but ugly. Typeform is pretty but pricey. Probe is free,
          open source, and ships every feature to everyone. No tiers, no metering, no
          &ldquo;contact sales.&rdquo;
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-14">
        {TIERS.map((tier) => {
          // The "Tip jar" CTA goes straight to the Razorpay link when one
          // is configured (public, build-time env var); otherwise it falls back
          // to /open-source, which has the donate card.
          const donateUrl = process.env.NEXT_PUBLIC_RAZORPAY_DONATE_LINK;
          const useDonate =
            tier.name === "Tip jar" && !!donateUrl && !donateUrl.includes("your-link");
          const href = useDonate ? donateUrl! : tier.cta.href;
          // Every tier's CTA is a real button: primary for the highlighted tier,
          // outlined (ghost) for the rest.
          const ctaClass = `btn mt-6 w-full justify-center ${
            tier.highlight ? "btn-primary" : "btn-ghost"
          }`;
          return (
            <div
              key={tier.name}
              className={`card flex flex-col ${
                tier.highlight ? "ring-2 ring-probe-500 shadow-md" : ""
              }`}
            >
              <div className="text-3xl">{tier.emoji}</div>
              <div className="font-bold text-lg mt-3">{tier.name}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="display text-4xl font-bold text-probe-900">{tier.price}</span>
                <span className="text-sm text-probe-700">/ {tier.cadence}</span>
              </div>
              <p className="text-sm text-probe-700 mt-3">{tier.blurb}</p>

              <ul className="mt-6 space-y-2 text-sm flex-1">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <span className="text-probe-500 font-bold">✓</span>
                    <span className="text-probe-900">{perk}</span>
                  </li>
                ))}
              </ul>

              {useDonate ? (
                <a href={href} target="_blank" rel="noreferrer" className={ctaClass}>
                  {tier.cta.label}
                </a>
              ) : (
                <Link href={href} className={ctaClass}>
                  {tier.cta.label}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-16 text-center">
        <h2 className="display text-2xl font-bold mb-2">&ldquo;What&apos;s the catch?&rdquo;</h2>
        <p className="text-probe-700 max-w-2xl mx-auto">
          There isn&apos;t one. Probe is a side project that got out of hand. Every paid
          form-builder feature you can think of — conditional logic, exports, password
          protection, analytics — is included on day one, for everyone.
        </p>
        <p className="mt-8 text-sm text-probe-700">
          Curious how it works?{" "}
          <Link href="/docs" className="underline">
            API reference
          </Link>{" "}
          ·{" "}
          <Link href="/explore" className="underline">
            Explore public forms
          </Link>
        </p>
      </div>
    </section>
  );
}
