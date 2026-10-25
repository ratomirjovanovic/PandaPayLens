import type { Metadata, Viewport } from "next";
import { Footer, Header } from "./SiteChrome";
import { themeInitScript } from "./ThemeToggle";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/** Metadata shared by the Vercel app and the GitHub Pages demo. */
export const rootMetadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: {
    default: `${SITE_NAME} - Open-Source Payment Error Decoder & Flow Visualizer`,
    template: `%s - ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Ratomir Jovanovic", url: "https://github.com/ratomirjovanovic" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Open-Source Payment Error Decoder & Flow Visualizer`,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
};

export const rootViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

/**
 * Document shell. `nonce` is set on the Vercel app (per-request CSP); the
 * static GitHub Pages build passes a meta-tag policy instead.
 */
export function RootShell({
  children,
  nonce,
  csp,
}: {
  children: React.ReactNode;
  nonce?: string;
  csp?: string;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {csp && <meta httpEquiv="Content-Security-Policy" content={csp} />}
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
