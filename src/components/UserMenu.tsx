import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth";

export async function UserMenu() {
  const { user } = await getCurrentUser();
  if (!user) return null;

  return (
    <>
      <nav className="row">
        <Link href="/tasks">Tasks</Link>
        <Link href="/import">Import CSV</Link>
      </nav>
      <div className="row">
        <span className="muted">{user.email}</span>
        <form action={signOut}>
          <button type="submit" className="link">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
