import Link from "next/link";
import { PandaMark } from "./PandaMark";
import { ThemeToggle } from "./ThemeToggle";
import { REPO_URL, MAINTAINER_URL } from "@/lib/site";

const NAV = [
  { href: "/analyze", label: "Analyze" },
  { href: "/examples", label: "Examples" },
  { href: "/providers", label: "Providers" },
  { href: "/docs", label: "Docs" },
  { href: "/changelog", label: "Changelog" },
  { href: "/about", label: "About" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:rounded focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <PandaMark size={28} />
          <span>
            PandaPay<span className="text-accent">Lens</span>
          </span>
        </Link>
        <nav aria-label="Main" className="ml-2 hidden gap-1 text-sm md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-2.5 py-1.5 text-fg-muted hover:bg-bg-subtle hover:text-fg"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={REPO_URL}
            className="hidden rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:text-fg sm:block"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </div>
      <nav
        aria-label="Main (mobile)"
        className="flex gap-1 overflow-x-auto border-t border-border px-2 py-1 text-sm md:hidden"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-fg-muted hover:text-fg"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-8 text-sm text-fg-muted md:flex-row md:items-center md:justify-between">
        <p>
          PandaPayLens is open source under the Apache License 2.0. Maintained by{" "}
          <a
            href={MAINTAINER_URL}
            className="underline underline-offset-2 hover:text-fg"
            rel="noopener noreferrer"
          >
            Ratomir Jovanovic
          </a>
          .
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-4">
          <Link href="/docs/security" className="hover:text-fg">
            Security &amp; privacy
          </Link>
          <Link href="/docs/providers" className="hover:text-fg">
            Providers
          </Link>
          <a href={REPO_URL} className="hover:text-fg" rel="noopener noreferrer">
            Source code
          </a>
        </nav>
      </div>
    </footer>
  );
}
