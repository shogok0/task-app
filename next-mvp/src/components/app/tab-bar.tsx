"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListTodo, Calendar, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: React.ComponentType<{ size?: number }> };

const TABS: Tab[] = [
  { href: "/app/today", label: "今日", icon: ListTodo },
  { href: "/app/upcoming", label: "予定", icon: Calendar },
  { href: "/app/settings", label: "設定", icon: Settings },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      role="tablist"
      aria-label="主要ナビゲーション"
      className="fixed inset-x-0 bottom-0 pb-safe border-t border-[color:var(--color-separator)] bg-[color:var(--color-surface-2)]/95 backdrop-blur-xl"
      style={{ zIndex: "var(--z-tab-bar)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[49px] flex-col items-center justify-center gap-1 transition-colors",
                  active ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-text-secondary)]"
                )}
              >
                <Icon size={24} />
                <span className="text-[10px] font-semibold tracking-tight">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
