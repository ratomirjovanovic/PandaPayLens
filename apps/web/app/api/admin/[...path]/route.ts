import { runAdmin, type AdminHandler } from "@/lib/admin/request";
import * as svc from "@/lib/admin/services";

export const dynamic = "force-dynamic";

type Route = { method: "GET" | "POST" | "PATCH"; pattern: string[]; handler: AdminHandler };

const body = async (req: Request) => {
  try {
    return (await req.json()) as unknown;
  } catch {
    throw new svc.ServiceError("VALIDATION_FAILED", "The request body is not valid JSON.");
  }
};

// ":id" segments are passed to the handler in order.
const ROUTES: Route[] = [
  { method: "GET", pattern: ["dashboard"], handler: (c) => svc.dashboard(c) },
  { method: "GET", pattern: ["providers"], handler: (c) => svc.listProviders(c) },
  { method: "GET", pattern: ["rules"], handler: (c) => svc.listDrafts(c) },
  {
    method: "POST",
    pattern: ["rules", "drafts"],
    handler: async (c) => svc.createDraft(c, await body(c.req)),
  },
  {
    method: "PATCH",
    pattern: ["rules", "drafts", ":id"],
    handler: async (c) => svc.updateDraft(c, c.params[0]!, await body(c.req)),
  },
  {
    method: "POST",
    pattern: ["rules", "drafts", ":id", "submit"],
    handler: (c) => svc.submitDraft(c, c.params[0]!),
  },
  {
    method: "POST",
    pattern: ["rules", "drafts", ":id", "approve"],
    handler: async (c) =>
      svc.reviewDraft(c, c.params[0]!, {
        ...((await body(c.req)) as object),
        decision: "approved",
      }),
  },
  {
    method: "POST",
    pattern: ["rules", "drafts", ":id", "reject"],
    handler: async (c) =>
      svc.reviewDraft(c, c.params[0]!, {
        ...((await body(c.req)) as object),
        decision: "rejected",
      }),
  },
  { method: "GET", pattern: ["releases"], handler: (c) => svc.listReleases(c) },
  { method: "GET", pattern: ["users"], handler: (c) => svc.listUsers(c) },
  {
    method: "POST",
    pattern: ["users", "roles"],
    handler: async (c) => svc.setUserRoles(c, await body(c.req)),
  },
  {
    method: "POST",
    pattern: ["users", "status"],
    handler: async (c) => svc.setUserStatus(c, await body(c.req)),
  },
  {
    method: "POST",
    pattern: ["invitations"],
    handler: async (c) => svc.inviteAdmin(c, await body(c.req)),
  },
  {
    method: "POST",
    pattern: ["invitations", ":id", "revoke"],
    handler: (c) => svc.revokeInvitation(c, c.params[0]!),
  },
  {
    method: "POST",
    pattern: ["sessions", "revoke"],
    handler: async (c) => svc.revokeSessions(c, await body(c.req)),
  },
  {
    method: "GET",
    pattern: ["audit-logs"],
    handler: (c) =>
      svc.listAuditLogs(c, { before: new URL(c.req.url).searchParams.get("before") ?? undefined }),
  },
  { method: "GET", pattern: ["settings"], handler: (c) => svc.getSettings(c) },
  {
    method: "PATCH",
    pattern: ["settings"],
    handler: async (c) => svc.updateSetting(c, await body(c.req)),
  },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function match(method: string, path: string[]) {
  for (const r of ROUTES) {
    if (r.method !== method || r.pattern.length !== path.length) continue;
    const ids: string[] = [];
    if (
      r.pattern.every((seg, i) =>
        seg === ":id" ? UUID.test(path[i]!) && ids.push(path[i]!) > 0 : seg === path[i],
      )
    )
      return { route: r, ids };
  }
  return null;
}

async function handle(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const m = match(req.method, path);
  if (!m)
    return runAdmin(req, [], async () => {
      throw new svc.ServiceError("NOT_FOUND", "Not found.", 404);
    });
  return runAdmin(req, m.ids, m.route.handler);
}

export { handle as GET, handle as POST, handle as PATCH };
