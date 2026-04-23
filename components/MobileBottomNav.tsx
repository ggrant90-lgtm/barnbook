"use client";

import { isNavActive, type NavItem } from "@/components/nav-config";
import Link from "next/link";

export function MobileBottomNav({ navItems, pathname }: { navItems: NavItem[]; pathname: string }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-brass-gold/20 bg-barn-dark px-1 py-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      aria-label="Quick navigation"
    >
      {navItems.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-medium sm:text-xs",
              active ? "text-brass-gold" : "text-muted-tan",
            ].join(" ")}
          >
            <span className={active ? "text-brass-gold" : "text-parchment/80"}>{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
