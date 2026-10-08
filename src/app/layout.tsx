import type { Metadata } from "next";
import { Suspense } from "react";
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
        <header className="site-header">
          <strong>Tasks</strong>
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
