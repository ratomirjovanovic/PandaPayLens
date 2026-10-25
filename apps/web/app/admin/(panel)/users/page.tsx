import { listUsers } from "@/lib/admin/services";
import { ActionButton, InviteForm } from "@/features/admin/Actions";
import { fmt, guarded, PageTitle, panelCtx, Table } from "@/features/admin/server";

export default async function UsersPage() {
  const ctx = await panelCtx();
  const r = await guarded(() => listUsers(ctx));
  if (!r.ok) return r.view;
  const me = ctx.principal!.userId;
  const now = new Date();
  return (
    <>
      <PageTitle
        title="Users"
        lead="Role changes, disabling and session revocation sign the user out everywhere. Sensitive actions ask for your passkey again."
      />
      <InviteForm />
      <h2 className="mb-2 mt-8 font-semibold">Administrators</h2>
      <Table
        head={["Email", "Roles", "Status", "Last login", "Actions"]}
        rows={r.data.users.map((u) => {
          const isSuper = u.roles.includes("superadmin");
          return [
            <span key="e" className="break-all">
              {u.email}
              {u.id === me && <span className="text-fg-muted"> (you)</span>}
            </span>,
            u.roles.join(", ") || "none",
            u.status,
            fmt(u.lastLoginAt),
            <div key="a" className="flex flex-wrap gap-1">
              {isSuper ? (
                <ActionButton
                  path="users/roles"
                  body={{ userId: u.id, roles: ["admin"] }}
                  label="Make admin"
                  confirm="Remove superadmin role?"
                />
              ) : (
                <ActionButton
                  path="users/roles"
                  body={{ userId: u.id, roles: ["superadmin"] }}
                  label="Make superadmin"
                  confirm="Grant superadmin?"
                />
              )}
              {u.roles.length > 0 && (
                <ActionButton
                  path="users/roles"
                  body={{ userId: u.id, roles: [] }}
                  label="Remove roles"
                  confirm="Remove all roles?"
                  danger
                />
              )}
              {u.status === "active" ? (
                <ActionButton
                  path="users/status"
                  body={{ userId: u.id, status: "disabled" }}
                  label="Disable"
                  confirm="Disable this account and end its sessions?"
                  danger
                />
              ) : (
                <ActionButton
                  path="users/status"
                  body={{ userId: u.id, status: "active" }}
                  label="Enable"
                />
              )}
              <ActionButton
                path="sessions/revoke"
                body={{ userId: u.id }}
                label="Revoke sessions"
                confirm="Sign this user out everywhere?"
              />
            </div>,
          ];
        })}
      />
      <h2 className="mb-2 mt-8 font-semibold">Invitations</h2>
      <Table
        head={["Email", "Role", "Expires", "State", ""]}
        rows={r.data.invitations.map((i) => {
          const state = i.acceptedAt
            ? "accepted"
            : i.revokedAt
              ? "revoked"
              : i.expiresAt < now
                ? "expired"
                : "open";
          return [
            <span key="e" className="break-all">
              {i.invitedIdentity}
            </span>,
            i.targetRole,
            fmt(i.expiresAt),
            state,
            state === "open" ? (
              <ActionButton key="r" path={`invitations/${i.id}/revoke`} label="Revoke" danger />
            ) : null,
          ];
        })}
      />
    </>
  );
}
