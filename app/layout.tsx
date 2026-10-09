import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Instrument_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

// next/font downloads these at build time and serves them from our own origin.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Almanac", template: "%s · Almanac" },
  description:
    "A calm, evidence-based record of what you eat, how you train, and how you recover.",
  applicationName: "Almanac",
  appleWebApp: { capable: true, title: "Almanac", statusBarStyle: "default" },
  icons: { apple: "/icons/180" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The theme override lives in a cookie so the server can render the right
  // palette on first paint. With no cookie, CSS follows the system setting.
  const stored = (await cookies()).get("theme")?.value;
  const theme = stored === "light" || stored === "dark" ? stored : undefined;

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${fraunces.variable} ${instrument.variable} ${geistMono.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-paper text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-3 focus:text-paper"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
