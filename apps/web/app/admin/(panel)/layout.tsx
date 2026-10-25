import Link from "next/link";
import { redirect } from "next/navigation";
import { authorize, AuthzError } from "@/lib/admin/authz";
import { currentPrincipal } from "@/lib/admin/request";
import { PasskeyGate, SignOutButton } from "@/features/admin/PasskeyGate";

const NAV = [
  { href: "/admin", label: "Dashboard", superadmin: false },
  { href: "/admin/rules", label: "Rules", superadmin: false },
  { href: "/admin/catalog", label: "Catalog", superadmin: false },
  { href: "/admin/providers", label: "Providers", superadmin: false },
  { href: "/admin/releases", label: "Releases", superadmin: false },
  { href: "/admin/audit-logs", label: "Audit log", superadmin: false },
  { href: "/admin/users", label: "Users", superadmin: true },
  { href: "/admin/settings", label: "Settings", superadmin: true },
  { href: "/admin/system", label: "System", superadmin: true },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const p = await currentPrincipal();
  if (!p) redirect("/admin/login");
  try {
    authorize(p, { role: "admin" });
  } catch (e) {
    const code = e instanceof AuthzError ? e.code : "FORBIDDEN";
    if (code === "PASSKEY_ENROLLMENT_REQUIRED" || code === "MFA_REQUIRED")
      return <PasskeyGate mode={code === "MFA_REQUIRED" ? "verify" : "enroll"} email={p.email} />;
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-semibold">
          {code === "ACCOUNT_DISABLED" ? "Account disabled" : "No admin access"}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          You are signed in as {p.email}, but this account has no active administrator role.
        </p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
    );
  }
  const superadmin = p.roles.includes("superadmin");
  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <nav aria-label="Admin" className="flex gap-1 overflow-x-auto text-sm md:flex-col">
        {NAV.filter((n) => !n.superadmin || superadmin).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-fg-muted hover:bg-bg-subtle hover:text-fg"
          >
            {n.label}
          </Link>
        ))}
        <div className="mt-4 hidden border-t border-border pt-3 text-xs text-fg-muted md:block">
          <p className="break-all">{p.email}</p>
          <p>{superadmin ? "Superadmin" : "Admin"} · passkey verified</p>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
