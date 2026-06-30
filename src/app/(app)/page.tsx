import { format, isPast } from "date-fns";
import Link from "next/link";
import { AlertTriangle, Clock, Sparkles, BarChart3, Timer } from "lucide-react";
import { getPrioritizedTasks, autoScheduleAction, getAnalytics, getRescueState } from "@/actions/tasks";
import { getRecommendations, getReminders } from "@/actions/ai";
import { getGoals, getHabits } from "@/actions/goals";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeedButton } from "@/components/seed-button";
import { RescueModeDashboard } from "@/components/tasks/rescue-mode-dashboard";
import { formatMinutes } from "@/lib/utils";

export default async function DashboardPage() {
  const rescueState = await getRescueState();
  const tasks = await getPrioritizedTasks();
  const recommendations = await getRecommendations();
  const reminders = await getReminders();
  const goals = await getGoals();
  const habits = await getHabits();
  const analytics = await getAnalytics();

  if (rescueState.isActive && rescueState.criticalTask) {
    return (
      <div className="space-y-8 animate-slide-up">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-critical">Rescue HQ (Active)</h1>
            <p className="mt-1 text-muted">
              Proactive safety override. AI is shielding you from critical deadline defaults.
            </p>
          </div>
          <div className="flex gap-2">
            <SeedButton />
          </div>
        </header>

        <RescueModeDashboard
          criticalTask={rescueState.criticalTask as any}
          explanation={rescueState.explanation}
          comparativeRankings={rescueState.comparativeRankings ?? []}
          postponedTasks={rescueState.postponedTasks}
          reservedBlocks={rescueState.reservedBlocks as any}
        />
      </div>
    );
  }


  const overdue = tasks.filter((t) => t.dueDate && isPast(new Date(t.dueDate)));
  const topThree = tasks.slice(0, 3);

  return (
    <div className="space-y-8 animate-slide-up">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rescue HQ</h1>
          <p className="mt-1 text-muted">
            Your AI companion surfaces what matters now — not passive reminders you&apos;ll ignore.
          </p>
        </div>
        <div className="flex gap-2">
          <SeedButton />
          <form action={autoScheduleAction}>
            <Button type="submit">
              <Sparkles className="h-4 w-4" />
              Auto-schedule day
            </Button>
          </form>
        </div>
      </header>

      {overdue.length > 0 && (
        <Card className="border-critical/30 bg-critical/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-critical" />
            <div>
              <p className="font-semibold text-critical">Rescue mode — {overdue.length} overdue</p>
              <p className="mt-1 text-sm text-muted">
                Start with &quot;{overdue[0].title}&quot;. Block 90 minutes and clear the oldest deadline first.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="AI priority stack"
            subtitle="Ranked by urgency score — deadline proximity, priority, and effort"
          />
          {topThree.length === 0 ? (
            <p className="text-sm text-muted">No tasks yet. Add one or load demo data.</p>
          ) : (
            <ul className="space-y-3">
              {topThree.map((task, i) => (
                <li
                  key={task.id}
                  className="flex items-start gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-surface-muted/50"
                >
                  <span className="font-mono text-2xl font-bold text-accent/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{task.title}</p>
                      <Badge variant={task.urgencyScore >= 70 ? "critical" : "warning"}>
                        {task.urgencyScore} urgency
                      </Badge>
                    </div>
                    {task.aiReason && (
                      <p className="mt-1 text-sm text-muted">{task.aiReason}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(task.dueDate), "MMM d, h:mm a")}
                        </span>
                      )}
                      <span>{formatMinutes(task.estimatedMinutes)}</span>
                      <span className="capitalize">{task.category}</span>
                    </div>
                  </div>
                  <Link href={`/focus?taskId=${task.id}`}>
                    <Button variant="secondary" className="shrink-0">Act</Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Smart recommendations" subtitle="Personalized nudges" />
          <ul className="space-y-3">
            {recommendations.map((rec, i) => (
              <li key={i} className="rounded-xl bg-surface-muted/60 p-3">
                <p className="text-sm font-medium">{rec.title}</p>
                <p className="mt-1 text-xs text-muted">{rec.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Context-aware reminders" subtitle="Not just pings — actionable context" />
          {reminders.length === 0 ? (
            <p className="text-sm text-muted">Reminders appear when tasks need attention.</p>
          ) : (
            <ul className="space-y-2">
              {reminders.map((r) => (
                <li key={r.id} className="flex gap-3 rounded-lg border border-border p-3 text-sm">
                  <Badge variant="muted" className="shrink-0 capitalize">{r.context}</Badge>
                  <div>
                    <p>{r.message}</p>
                    <p className="mt-1 text-xs text-muted">
                      {format(new Date(r.scheduledFor), "h:mm a")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Goals & habits snapshot" />
          <div className="space-y-4">
            {goals.slice(0, 2).map((g) => (
              <div key={g.id}>
                <div className="flex justify-between text-sm">
                  <span>{g.title}</span>
                  <span className="font-mono text-muted">{g.progress}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-surface-muted">
                  <div
                    className="h-2 rounded-full bg-success transition-all"
                    style={{ width: `${g.progress}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              {habits.slice(0, 3).map((h) => (
                <Badge key={h.id} variant="success">
                  {h.title} · {h.streak}🔥
                </Badge>
              ))}
            </div>
            <Link href="/goals" className="text-sm text-accent hover:underline">
              Manage goals & habits →
            </Link>
          </div>
        </Card>
      </div>

      {/* Analytics Snapshot */}
      <Card>
        <CardHeader
          title="Productivity snapshot"
          subtitle="How AI is helping you win against deadlines"
          action={
            <Link href="/analytics" className="text-xs text-accent hover:underline flex items-center gap-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Full analytics
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Tasks completed", value: analytics.completed, color: "text-success" },
            { label: "On-time rate", value: `${analytics.onTimeRate}%`, color: "text-accent" },
            { label: "Overdue now", value: analytics.overdue, color: analytics.overdue > 0 ? "text-critical" : "text-success" },
            { label: "Time saved", value: formatMinutes(analytics.timeSavedMinutes), color: "text-foreground" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-surface-muted/60 p-3">
              <p className="text-xs text-muted">{kpi.label}</p>
              <p className={`mt-1 text-xl font-bold tracking-tight ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Top pending task quick-launch */}
        {tasks[0] && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted">Highest urgency task</p>
              <p className="mt-0.5 truncate text-sm font-semibold">{tasks[0].title}</p>
            </div>
            <Link href={`/focus?taskId=${tasks[0].id}`}>
              <Button className="shrink-0 ml-3">
                <Timer className="h-4 w-4" />
                Start Focus
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
