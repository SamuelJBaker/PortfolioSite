import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { Viewport } from "next";
import "./globals.css";
import { AnalyticsBeacon } from "../components/scripts/AnalyticsBeacon";
import { profile } from "../content/profile";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BG = "#0a0a0d"; // dark grey

const DESCRIPTION =
  "Computer science graduate from the University of Virginia (AI). Inverse rendering, GPU path tracing, C++ performance engineering, and ML systems.";

export const metadata: Metadata = {
  // Resolves the relative og.png below to an absolute URL for crawlers.
  metadataBase: new URL(profile.siteUrl),
  title: profile.name,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    title: profile.name,
    description: DESCRIPTION,
    url: profile.siteUrl,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: profile.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: profile.name,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
const prepaintStyle: React.CSSProperties = {
  backgroundColor: BG,
  backgroundImage: `
    radial-gradient(900px circle at 30% 25%, rgba(120,150,220,0.055), transparent 55%),
    radial-gradient(900px circle at 70% 65%, rgba(212,175,90,0.04), transparent 58%)
  `,
  backgroundSize: "auto, auto",
  backgroundPosition: "center, center",
};

  return (
    <html lang="en" style={{ backgroundColor: BG, colorScheme: "dark" }}>
<head>
  <style>{`
    html, body { background: #0a0a0d; }
    canvas { background: transparent !important; }
  `}</style>
</head>
      <body
        style={{ backgroundColor: BG }}
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased text-neutral-100`}
      >
        {/* Prepaint layer: always visible immediately */}
        <div
          aria-hidden="true"
          style={prepaintStyle}
          className="fixed inset-0 z-0 pointer-events-none"
        />

        {/* Route groups: (site) adds the canvas and content root, (admin) only the content root. */}
        {children}
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
