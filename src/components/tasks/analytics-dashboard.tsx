"use client";

import { formatMinutes } from "@/lib/utils";

type Analytics = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  onTime: number;
  timeSavedMinutes: number;
  completionRate: number;
  onTimeRate: number;
  categoryBreakdown: Record<string, number>;
  recentCompletions: number;
};

function RingChart({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--surface-muted)" strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        <text x="48" y="53" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">
          {pct}%
        </text>
      </svg>
      <span className="text-xs text-muted font-medium text-center">{label}</span>
    </div>
  );
}

export function AnalyticsDashboard({ stats }: { stats: Analytics }) {
  const categoryColors: Record<string, string> = {
    deadline: "bg-critical/80",
    assignment: "bg-accent/80",
    meeting: "bg-warning/80",
    interview: "bg-success/80",
    bills: "bg-muted/60",
    general: "bg-surface-muted",
  };

  const maxCategoryCount = Math.max(...Object.values(stats.categoryBreakdown), 1);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Total Tasks",
            value: stats.total,
            sub: `${stats.completed} completed`,
            color: "text-foreground",
          },
          {
            label: "Overdue",
            value: stats.overdue,
            sub: "need rescue now",
            color: stats.overdue > 0 ? "text-critical" : "text-success",
          },
          {
            label: "Completed This Week",
            value: stats.recentCompletions,
            sub: "in last 7 days",
            color: "text-success",
          },
          {
            label: "Time Saved",
            value: formatMinutes(stats.timeSavedMinutes),
            sub: "by beating deadlines",
            color: "text-accent",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-muted">{kpi.label}</p>
            <p className={`text-2xl font-bold tracking-tight ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Ring Charts Row */}
      <div className="flex flex-wrap justify-around gap-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <RingChart
          pct={stats.completionRate}
          color="var(--success)"
          label="Completion Rate"
        />
        <RingChart
          pct={stats.onTimeRate}
          color="var(--accent)"
          label="On-Time Rate"
        />
        <RingChart
          pct={stats.total > 0 ? Math.round(((stats.total - stats.overdue) / stats.total) * 100) : 100}
          color="var(--warning)"
          label="Deadline Health"
        />
      </div>

      {/* Category Breakdown */}
      {Object.keys(stats.categoryBreakdown).length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold tracking-tight">Pending by Category</p>
          <div className="space-y-3">
            {Object.entries(stats.categoryBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => (
                <div key={cat}>
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span className="capitalize font-medium">{cat}</span>
                    <span>{count} task{count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${categoryColors[cat] ?? "bg-accent/70"}`}
                      style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
