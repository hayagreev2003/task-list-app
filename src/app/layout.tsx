import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckSquareIcon } from "@/components/icons";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tasks",
  description: "A task list with CSV import",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                <CheckSquareIcon />
              </span>
              Tasks
            </Link>
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main id="content">{children}</main>
      </body>
    </html>
  );
}
