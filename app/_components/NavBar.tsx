"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/ask", label: "Ask AI" },
] as const;

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          Logistics AI Dashboard
        </span>
        <div className="flex gap-5">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "text-sm font-medium text-zinc-900 dark:text-zinc-50"
                    : "text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
