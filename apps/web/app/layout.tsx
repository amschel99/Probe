import "./globals.css";

import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";

import { Providers } from "./providers";

// Fonts are committed (app/fonts, Latin subset, OFL) and loaded locally so the
// build never depends on reaching Google Fonts. Instrument Serif for headlines,
// Inter Tight for reading, JetBrains Mono for labels, buttons and readouts.
const display = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  display: "swap",
  variable: "--font-instrument-serif",
});
const sans = localFont({
  src: "./fonts/InterTight-Variable.woff2",
  weight: "300 600",
  display: "swap",
  variable: "--font-inter-tight",
});
const mono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  weight: "400 500",
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Probe — forms on your own ground",
  description:
    "Probe is a free, self-hosted form builder. Hosted forms, form-to-email endpoints, webhooks and an API your agents can drive. Your server, your database.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
