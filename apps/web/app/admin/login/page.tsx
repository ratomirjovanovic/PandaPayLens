import { redirect } from "next/navigation";
import { currentPrincipal } from "@/lib/admin/request";
import { LoginForm } from "@/features/admin/LoginForm";

export default async function AdminLogin() {
  if (await currentPrincipal()) redirect("/admin");
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Admin sign-in</h1>
      <p className="mt-2 text-sm text-fg-muted">
        The public analyzer never needs an account. This area is for project administrators.
      </p>
      <LoginForm />
    </div>
  );
}
