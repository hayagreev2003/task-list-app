"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListIcon, UploadIcon } from "./icons";

const TABS = [
  { href: "/tasks", label: "Tasks", Icon: ListIcon },
  { href: "/import", label: "Import CSV", Icon: UploadIcon },
] as const;

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="nav-tabs">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className="nav-tab" aria-current={active ? "page" : undefined}>
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
