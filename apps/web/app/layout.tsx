import "./globals.css";

import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono, Tektur } from "next/font/google";
import { Toaster } from "sonner";

import { Providers } from "./providers";

// Display: Tektur — angular, techno, a little Y2K. Body: Instrument Sans.
// Mono: JetBrains Mono for system labels, readouts and code.
const display = Tektur({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-tektur",
  weight: ["500", "600", "700", "800"],
});
const sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
  weight: ["400", "500", "600", "700"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Probe — forms that phone home",
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
