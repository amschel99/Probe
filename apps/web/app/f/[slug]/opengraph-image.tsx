import { readFile } from "node:fs/promises";
import path from "node:path";

import { headers } from "next/headers";
import { ImageResponse } from "next/og";

import { api } from "@/lib/trpc-server";

// Link preview for a hosted form — what WhatsApp, Slack, X and iMessage show
// when the link is pasted. Paper, ink and a gold signal, like the site.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Probe form";

const PAPER = "#F2EDE5";
const INK = "#111211";
const BODY = "#3B3F3E";
const MUTED = "#5F6462";
const GOLD = "#C8963E";

async function font(file: string) {
  // ImageResponse needs TTF/OTF (not the site's woff2), committed in assets/og.
  return readFile(path.join(process.cwd(), "assets/og", file));
}

function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export default async function Image({ params }: { params: { slug: string } }) {
  let title = "A form on Probe";
  let description = "Takes a minute to fill in.";
  try {
    const result = await api.public.getForm.query({ slug: params.slug });
    if (result.passwordRequired || !result.form) {
      title = "A private form";
      description = "You'll need the password to open it.";
    } else {
      title = result.form.title;
      description = result.form.description || description;
    }
  } catch {
    // Closed or missing forms still get a tidy generic card.
  }

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";

  const [serif, sans, mono] = await Promise.all([
    font("InstrumentSerif-Regular.ttf"),
    font("InterTight-Regular.ttf"),
    font("JetBrainsMono-Medium.ttf"),
  ]);

  const titleText = clip(title, 90);
  const titleSize = titleText.length <= 32 ? 92 : titleText.length <= 60 ? 74 : 58;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          padding: "64px 72px",
          position: "relative",
        }}
      >
        {/* gold signal + orbit, bleeding off the right edge */}
        <div
          style={{
            position: "absolute",
            right: -90,
            top: 120,
            width: 300,
            height: 300,
            borderRadius: 9999,
            background: GOLD,
            display: "flex",
          }}
        />
        <svg
          width="520"
          height="220"
          viewBox="0 0 520 220"
          style={{ position: "absolute", right: -160, top: 160 }}
        >
          <ellipse
            cx="260"
            cy="110"
            rx="250"
            ry="70"
            transform="rotate(-16 260 110)"
            fill="none"
            stroke={INK}
            strokeWidth="2"
          />
        </svg>

        {/* masthead */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="44" height="44" viewBox="0 0 48 48">
            <circle cx="24" cy="27" r="7" fill={GOLD} />
            <ellipse
              cx="24"
              cy="27"
              rx="19"
              ry="7"
              transform="rotate(-18 24 27)"
              fill="none"
              stroke={INK}
              strokeWidth="1.8"
            />
            <path d="M24 20V6" stroke={INK} strokeWidth="1.8" />
            <circle cx="24" cy="5" r="2.6" fill={INK} />
            <circle cx="41.2" cy="21.6" r="2.4" fill={INK} />
          </svg>
          <div style={{ fontFamily: "Serif", fontSize: 40, color: INK, letterSpacing: -1 }}>
            Probe
          </div>
        </div>

        {/* title + description */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 860 }}>
          <div
            style={{
              fontFamily: "Serif",
              fontSize: titleSize,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: INK,
            }}
          >
            {titleText}
          </div>
          <div
            style={{
              fontFamily: "Sans",
              fontSize: 30,
              lineHeight: 1.4,
              color: BODY,
              marginTop: 22,
            }}
          >
            {clip(description, 130)}
          </div>
        </div>

        {/* call to action */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              background: INK,
              color: "#FFFFFF",
              fontFamily: "Mono",
              fontSize: 26,
              padding: "18px 30px",
              letterSpacing: 0.5,
            }}
          >
            Fill in the form →
          </div>
          {host && (
            <div style={{ fontFamily: "Mono", fontSize: 22, color: MUTED }}>{host}</div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Serif", data: serif, weight: 400, style: "normal" },
        { name: "Sans", data: sans, weight: 400, style: "normal" },
        { name: "Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
