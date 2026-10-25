import Link from "next/link";
import { PandaMark } from "@/components/PandaMark";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <PandaMark size={96} />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-fg-muted">Even with a lens, we couldn&apos;t find that page.</p>
      <Link href="/" className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-fg">
        Go home
      </Link>
    </div>
  );
}
