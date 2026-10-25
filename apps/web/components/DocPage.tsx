import Link from "next/link";

const DOC_NAV = [
  { href: "/docs", label: "Getting started" },
  { href: "/docs/providers", label: "Providers & formats" },
  { href: "/docs/security", label: "Security & privacy" },
];

export function DocPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[200px_1fr]">
      <nav aria-label="Documentation" className="text-sm md:sticky md:top-24 md:self-start">
        <ul className="flex gap-3 overflow-x-auto md:flex-col md:gap-1">
          {DOC_NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                className="block rounded-md px-2 py-1 text-fg-muted hover:bg-bg-subtle hover:text-fg"
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="prose-doc min-w-0 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {lead && <p className="text-lg text-fg-muted">{lead}</p>}
        {children}
      </article>
    </div>
  );
}
