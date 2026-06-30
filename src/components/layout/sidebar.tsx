"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  MessageCircle,
  Target,
  Zap,
  Timer,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Rescue HQ", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/focus", label: "Focus Zone", icon: Timer },
  { href: "/assistant", label: "AI Coach", icon: MessageCircle },
  { href: "/calendar", label: "Schedule", icon: CalendarDays },
  { href: "/goals", label: "Goals & Habits", icon: Target },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar({ hasOpenAI }: { hasOpenAI: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-surface">
      <div className="border-b border-border p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Last-Minute</p>
            <p className="text-xs text-muted">Life Saver</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Proactive AI that helps you act before deadlines become disasters.
        </p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="rounded-xl bg-surface-muted p-3">
          <p className="text-xs font-medium text-foreground">AI status</p>
          <p className="mt-1 text-xs text-muted">
            {hasOpenAI
              ? "OpenAI connected — full intelligence"
              : "Smart rules active — add OPENAI_API_KEY for GPT"}
          </p>
        </div>
      </div>
    </aside>
  );
}
