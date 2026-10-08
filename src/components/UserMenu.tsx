import { getCurrentUser } from "@/lib/auth";
import { NavTabs } from "./NavTabs";
import { ProfileMenu } from "./ProfileMenu";

/** Signed-in navigation: page tabs and the account menu. Renders nothing when signed out. */
export async function UserMenu() {
  const { user } = await getCurrentUser();
  if (!user) return null;

  return (
    <>
      <NavTabs />
      <ProfileMenu email={user.email} />
    </>
  );
}
