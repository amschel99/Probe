import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// Probe documentation site (Astro + Starlight).
// Served under the `/docs` path: in production the API server serves the static
// build at /docs (the Scalar API reference moved to /api/docs). `base: "/docs"`
// makes every asset + link resolve under that prefix.
export default defineConfig({
  site: process.env.PUBLIC_APP_URL || "https://probe.jahazi.city",
  base: "/docs",
  integrations: [
    starlight({
      title: "Probe",
      description: "Self-hosted forms. Your server, your database.",
      logo: { src: "./src/assets/mark.svg", alt: "Probe" },
      favicon: "/favicon.svg",
      customCss: ["./src/styles/probe.css"],
      // Light-only, like the app.
      components: {
        ThemeProvider: "./src/components/ThemeProvider.astro",
        ThemeSelect: "./src/components/ThemeSelect.astro",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/amschel99/Probe",
        },
      ],
      sidebar: [
        {
          label: "Guides",
          items: [
            { label: "Getting started", slug: "guides/getting-started" },
            { label: "Endpoint forms", slug: "guides/endpoint-forms" },
            { label: "AI form generation", slug: "guides/ai-generation" },
            { label: "API and agents", slug: "guides/api-and-agents" },
          ],
        },
        {
          label: "Self-hosting",
          items: [
            { label: "Deploy on Railway", slug: "guides/deployment" },
            { label: "Local development", slug: "guides/local-development" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Environment variables", slug: "reference/environment" },
            { label: "Architecture", slug: "reference/architecture" },
            { label: "API reference", link: "/api/docs", attrs: { target: "_blank" } },
            { label: "llms.txt", link: "/llms.txt", attrs: { target: "_blank" } },
          ],
        },
      ],
    }),
  ],
});
