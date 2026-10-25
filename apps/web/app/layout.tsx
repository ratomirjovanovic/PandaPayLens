import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Footer, Header } from "@/components/SiteChrome";
import { themeInitScript } from "@/components/ThemeToggle";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: payment error decoder and webhook timeline`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Ratomir Jovanovic", url: "https://github.com/ratomirjovanovic" }],
  keywords: [
    "payment error decoder",
    "Stripe error decoder",
    "Adyen error decoder",
    "payment webhook visualizer",
    "payment debugging tool",
    "Stripe decline code lookup",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_TAGLINE,
    url: "/",
  },
  twitter: { card: "summary", title: SITE_NAME, description: SITE_TAGLINE },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
