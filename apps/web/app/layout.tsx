import { headers } from "next/headers";
import "./globals.css";
import { RootShell, rootMetadata, rootViewport } from "@/components/RootShell";

export const metadata = rootMetadata;
export const viewport = rootViewport;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <RootShell nonce={nonce}>{children}</RootShell>;
}
