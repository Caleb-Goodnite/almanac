"use client";

import { Barbell, BowlFood, ChatText, Heartbeat, Sun } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/today", label: "Today", Icon: Sun },
  { href: "/food", label: "Food", Icon: BowlFood },
  { href: "/train", label: "Train", Icon: Barbell },
  { href: "/body", label: "Body", Icon: Heartbeat },
  { href: "/coach", label: "Coach", Icon: ChatText },
] as const;

/**
 * Primary navigation: a bottom tab bar on phones, a left rail from the md
 * breakpoint up. The current tab is marked with aria-current, a rule and
 * heavier text, not colour alone.
 */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper md:static md:w-44 md:shrink-0 md:border-t-0 md:border-r md:pb-0"
    >
      <Link href="/today" className="display hidden px-6 pt-8 pb-6 text-2xl md:block">
        Almanac<span className="text-accent">.</span>
      </Link>
      <ul className="mx-auto flex max-w-lg md:mx-0 md:max-w-none md:flex-col">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-ink-soft md:min-h-12 md:flex-row md:justify-start md:gap-3 md:border-t-0 md:border-l-2 md:px-6",
                  active ? "border-accent text-ink" : "border-transparent hover:text-ink",
                )}
              >
                <Icon aria-hidden size={22} weight={active ? "regular" : "light"} />
                <span className={cn("text-[0.6875rem] md:text-sm", active ? "font-semibold" : "font-medium")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
