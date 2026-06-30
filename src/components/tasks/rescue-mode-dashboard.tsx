"use client";

import { format } from "date-fns";
import Link from "next/link";
import { AlertOctagon, Clock, Flame, ArrowRight, Zap, CheckCircle2, ShieldAlert, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Task = {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
  estimatedMinutes: number;
  category: string;
  urgencyScore: number;
  aiReason: string | null;
};

type ScheduleBlock = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
};

type Explanation = {
  reason: string;
  plan: string;
};

type ComparativeRanking = {
  taskId: string;
  taskTitle: string;
  comparativeReasoning: string;
};

export function RescueModeDashboard({
  criticalTask,
  explanation,
  comparativeRankings,
  postponedTasks,
  reservedBlocks,
}: {
  criticalTask: Task;
  explanation: Explanation;
  comparativeRankings: ComparativeRanking[];
  postponedTasks: Array<{ id: string; title: string; priority: string }>;
  reservedBlocks: ScheduleBlock[];
}) {
  return (
    <div className="space-y-6 animate-pulse-once">
      {/* Rescue Mode Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-critical/30 bg-gradient-to-r from-critical/15 to-transparent p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-critical/20 text-critical animate-pulse">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="critical" className="animate-pulse">Rescue Mode Active</Badge>
                <span className="text-xs text-muted font-medium">Automatic Proactive Intervention</span>
              </div>
              <h2 className="mt-1.5 text-xl font-bold tracking-tight text-foreground">
                Deadline Hazard Detected
              </h2>
              <p className="text-xs text-muted/90 mt-0.5">
                AI has autonomously rescheduled today's focus blocks to secure your critical deadlines.
              </p>
            </div>
          </div>
          
          <Link href={`/focus?taskId=${criticalTask.id}`}>
            <Button className="bg-critical hover:bg-critical/90 text-white shrink-0 group py-2.5 px-5 font-semibold text-sm">
              <Flame className="mr-2 h-5 w-5 inline" />
              Engage Rescue Focus
              <ArrowRight className="ml-2 h-4 w-4 inline transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Most Urgent Task Details & AI Rationale */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-critical/20 p-6">
            <CardHeader 
              title="Target Critical Task" 
              subtitle="The task putting your deadline at immediate risk"
            />
            
            <div className="mt-4 rounded-xl border border-border bg-surface-muted/40 p-4">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="font-semibold text-lg">{criticalTask.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                    {criticalTask.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Due: {format(new Date(criticalTask.dueDate), "MMM d, h:mm a")}
                      </span>
                    )}
                    <span>Est: {criticalTask.estimatedMinutes} mins</span>
                    <span className="capitalize">Category: {criticalTask.category}</span>
                  </div>
                </div>
                <Badge variant="critical" className="text-sm py-1 px-2 shrink-0">
                  {criticalTask.urgencyScore} Urgency
                </Badge>
              </div>

              {criticalTask.aiReason && (
                <div className="mt-4 border-t border-border/60 pt-3 text-xs text-muted italic">
                  <b>AI Threat Analysis:</b> {criticalTask.aiReason}
                </div>
              )}
            </div>

            {/* AI Narrative plan */}
            <div className="mt-6 space-y-2">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-accent" />
                AI Agent Intervention Action Plan
              </h4>
              <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-muted whitespace-pre-line">
                {explanation.plan}
              </div>
            </div>

            {/* Comparative Priority Ranking Rationale */}
            {comparativeRankings.length > 0 && (
              <div className="mt-6 space-y-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ListOrdered className="h-3.5 w-3.5 text-accent" />
                  Priority Ranking Rationale
                </h4>
                <div className="space-y-2">
                  {comparativeRankings.map((ranking, idx) => (
                    <div
                      key={ranking.taskId}
                      className={`rounded-xl border p-3.5 flex items-start gap-3 ${
                        idx === 0
                          ? "border-critical/30 bg-critical/5"
                          : "border-border bg-surface-muted/30"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          idx === 0
                            ? "bg-critical/20 text-critical"
                            : "bg-border/60 text-muted"
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{ranking.taskTitle}</p>
                        <p className="text-xs text-muted mt-0.5 leading-relaxed">{ranking.comparativeReasoning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* reserved focus blocks timeline */}
          <Card className="p-6">
            <CardHeader 
              title="Today's Reserved Focus Blocks" 
              subtitle="Uninterrupted blocks dedicated exclusively to your urgent tasks"
            />
            
            <div className="mt-4 space-y-3">
              {reservedBlocks.map((block) => (
                <div 
                  key={block.id}
                  className="flex items-center gap-4 rounded-xl border border-critical/10 bg-critical/5 p-4"
                >
                  <div className="font-mono text-xs text-muted shrink-0 w-24">
                    {format(new Date(block.startTime), "h:mm a")}
                    <br />
                    {format(new Date(block.endTime), "h:mm a")}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{block.title}</p>
                    <span className="text-xs text-muted/80">Reserved Focus Window</span>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-critical shrink-0" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Postponed tasks sidebar */}
        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader 
              title="Postponed Workload" 
              subtitle="Pushed back to create focus blocks"
            />

            {postponedTasks.length === 0 ? (
              <p className="mt-4 text-xs text-muted">No low-priority tasks had to be postponed today.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {postponedTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className="flex justify-between items-center rounded-xl border border-border bg-surface-muted/30 p-3 opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted line-through truncate font-medium">{task.title}</p>
                      <Badge variant="muted" className="mt-1 text-[10px] py-0 px-1 capitalize">{task.priority} Priority</Badge>
                    </div>
                    <span className="text-[10px] text-muted font-medium bg-border/40 px-1.5 py-0.5 rounded-full shrink-0">
                      Postponed
                    </span>
                  </div>
                ))}
                
                <div className="rounded-xl bg-surface-muted/50 p-3 text-xs text-muted/80 leading-relaxed border border-border/40">
                  <ShieldAlert className="h-4 w-4 inline mr-1 text-muted" />
                  These tasks are categorized as low priority. The agent has bypassed scheduling them today to protect your high-urgency deadlines. They will be rescheduled automatically tomorrow.
                </div>
              </div>
            )}
          </Card>

          {/* Quick exit reminder card */}
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm text-center">
            <p className="text-xs font-medium text-muted">Need to exit Rescue Mode?</p>
            <p className="text-[11px] text-muted/80 mt-1 leading-relaxed">
              Once you complete the target critical task, the interface will automatically return to your regular dashboard workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
