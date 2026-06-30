"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Check, Trash2, Wand2, Timer, Sparkles, AlertTriangle } from "lucide-react";
import { createTask, deleteTask, updateTaskStatus, breakDownTask, toggleSubtask } from "@/actions/tasks";
import { executeSubtaskAction } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMinutes } from "@/lib/utils";

type SubTask = {
  id: string;
  title: string;
  completed: boolean;
  order: number;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  estimatedMinutes: number;
  category: string;
  urgencyScore: number;
  aiReason: string | null;
  feasibilityPlan?: string | null;
  subtasks: SubTask[];
  contextTags?: string;
};

export function TaskBoard({ initialTasks }: { initialTasks: Task[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPriorityReason, setShowPriorityReason] = useState<Record<string, boolean>>({});
  const [showFallbackPlan, setShowFallbackPlan] = useState<Record<string, boolean>>({});

  const [executingSubtask, setExecutingSubtask] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [loadingExecution, setLoadingExecution] = useState(false);

  async function handleExecuteSubtask(taskId: string, subtaskTitle: string) {
    setExecutingSubtask(subtaskTitle);
    setLoadingExecution(true);
    setExecutionResult(null);
    try {
      const res = await executeSubtaskAction(taskId, subtaskTitle);
      setExecutionResult(res.result || "Execution completed.");
    } catch (e) {
      setExecutionResult("Failed to execute subtask.");
    } finally {
      setLoadingExecution(false);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const res = await createTask(formData);
    if (res && "error" in res && res.error) {
      setError(res.error);
    } else if (res && "task" in res && res.task) {
      const newTask = {
        ...res.task,
        subtasks: []
      };
      setTasks((prev) => [newTask, ...prev]);
      form.reset();
      router.refresh();
    }
  }

  async function handleComplete(id: string) {
    setLoading(id);
    await updateTaskStatus(id, "completed");
    setTasks((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
    setLoading(null);
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
  }

  async function handleBreakDown(id: string) {
    setLoading(id);
    const res = await breakDownTask(id);
    if (res && "error" in res && res.error) {
      alert(res.error);
    } else if (res && "subtasks" in res && res.subtasks) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, subtasks: res.subtasks as SubTask[] } : t
        )
      );
      router.refresh();
    }
    setLoading(null);
  }

  async function handleToggleSubtask(id: string, completed: boolean) {
    await toggleSubtask(id, completed);
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        subtasks: t.subtasks.map((s) => (s.id === id ? { ...s, completed } : s)),
      })),
    );
    router.refresh();
  }

  const pending = tasks.filter((t) => t.status === "pending" || t.status === "at_risk");

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader title="Add task" subtitle="Capture commitments before they become crises" />
        {error && (
          <p className="mb-2 text-xs text-critical font-medium">{error}</p>
        )}
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <input
            name="title"
            required
            placeholder="What can't you miss?"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select name="priority" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            name="description"
            placeholder="Details (optional)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            name="dueDate"
            type="datetime-local"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            name="estimatedMinutes"
            type="number"
            defaultValue={30}
            min={5}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select name="category" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="general">General</option>
            <option value="deadline">Deadline</option>
            <option value="assignment">Assignment</option>
            <option value="meeting">Meeting</option>
            <option value="interview">Interview</option>
            <option value="bills">Bills</option>
          </select>
          <input
            name="contextTags"
            placeholder="Context tags (comma separated, e.g. desk, phone, home)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
          />
          <Button type="submit" className="sm:col-span-2">Add task</Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title={`${pending.length} pending tasks`}
          subtitle="Sorted by AI urgency score"
        />
        <ul className="space-y-4">
          {pending.map((task) => (
            <li key={task.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{task.title}</h3>
                    <Badge variant={task.urgencyScore >= 70 ? "critical" : "default"}>
                      {task.urgencyScore}
                    </Badge>
                    <Badge variant="muted" className="capitalize">{task.priority}</Badge>
                    {task.status === "at_risk" && (
                      <Badge variant="critical">At Risk</Badge>
                    )}
                  </div>
                  {task.description && (
                    <p className="mt-1 text-sm text-muted">{task.description}</p>
                  )}
                  {task.aiReason && (
                    <div className="mt-2">
                      <button
                        onClick={() =>
                          setShowPriorityReason((prev) => ({
                            ...prev,
                            [task.id]: !prev[task.id],
                          }))
                        }
                        className="text-xs text-accent hover:underline flex items-center gap-1 font-medium select-none"
                      >
                        {showPriorityReason[task.id] ? "Hide priority analysis" : "Why this priority?"}
                      </button>
                      {showPriorityReason[task.id] && (
                        <div className="mt-2 rounded-xl bg-surface-muted/40 p-3 text-xs leading-relaxed text-muted border border-border/30 whitespace-pre-line">
                          {task.aiReason}
                        </div>
                      )}
                    </div>
                  )}

                  {(() => {
                    if (!task.feasibilityPlan) return null;
                    try {
                      const plan = JSON.parse(task.feasibilityPlan) as {
                        reducedScopeDescription: string;
                        draftMessage: string;
                        estimatedRecoveredMinutes: number;
                      };
                      return (
                        <div className="mt-2">
                          <button
                            onClick={() =>
                              setShowFallbackPlan((prev) => ({
                                ...prev,
                                [task.id]: !prev[task.id],
                              }))
                            }
                            className="text-xs text-critical hover:underline flex items-center gap-1 font-medium select-none"
                          >
                            <AlertTriangle className="h-3 w-3 text-critical animate-pulse" />
                            {showFallbackPlan[task.id] ? "Hide fallback plan" : "View AI Fallback Plan (At Risk)"}
                          </button>
                          {showFallbackPlan[task.id] && (
                            <div className="mt-2 rounded-xl bg-critical/5 p-4 text-xs leading-relaxed text-muted border border-critical/20 space-y-3">
                              <div>
                                <span className="font-semibold text-critical block mb-1">Reduced Scope Option:</span>
                                <p className="text-foreground/90">{plan.reducedScopeDescription}</p>
                                <span className="text-muted/80 text-[10px] mt-1 block">
                                  Saves approximately {plan.estimatedRecoveredMinutes} minutes
                                </span>
                              </div>
                              <div className="border-t border-critical/10 pt-2">
                                <span className="font-semibold text-critical block mb-1">Draft Message (Request Extension/Explain Partial):</span>
                                <div className="bg-surface-muted/30 p-2 rounded-lg border border-border/55 italic relative group mt-1">
                                  <p className="pr-20 text-foreground/80">{plan.draftMessage}</p>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(plan.draftMessage);
                                      alert("Draft copied to clipboard!");
                                    }}
                                    className="absolute right-2 top-2 text-[10px] font-semibold bg-critical/10 hover:bg-critical/20 text-critical px-2 py-1 rounded transition-colors cursor-pointer select-none"
                                  >
                                    Copy Draft
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    } catch (e) {
                      console.error("Failed to parse feasibility plan JSON:", e);
                      return null;
                    }
                  })()}
                  {task.contextTags && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {JSON.parse(task.contextTags || "[]").map((tag: string) => (
                        <span key={tag} className="inline-flex items-center rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                    {task.dueDate && (
                      <span>Due {format(new Date(task.dueDate), "MMM d, h:mm a")}</span>
                    )}
                    <span>{formatMinutes(task.estimatedMinutes)}</span>
                    <span className="capitalize">{task.category}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/focus?taskId=${task.id}`}>
                    <Button variant="secondary">
                      <Timer className="h-4 w-4 text-accent" />
                      Focus
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    onClick={() => handleBreakDown(task.id)}
                    disabled={loading === task.id}
                  >
                    <Wand2 className="h-4 w-4" />
                    AI breakdown
                  </Button>
                  <Button onClick={() => handleComplete(task.id)} disabled={loading === task.id}>
                    <Check className="h-4 w-4" />
                    Done
                  </Button>
                  <Button variant="ghost" onClick={() => handleDelete(task.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {task.subtasks.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-border pt-4">
                  {task.subtasks.map((sub) => (
                    <li key={sub.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sub.completed}
                        onChange={(e) => handleToggleSubtask(sub.id, e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className={sub.completed ? "text-muted line-through" : ""}>
                        {sub.title}
                      </span>
                      {!sub.completed && (
                        <button
                          onClick={() => handleExecuteSubtask(task.id, sub.title)}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <Sparkles className="h-3 w-3 animate-pulse text-accent" />
                          Execute
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {executingSubtask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col justify-between overflow-hidden">
            <CardHeader
              title="AI Autonomous Agent"
              subtitle={`Executing: "${executingSubtask}"`}
            />
            <div className="flex-1 overflow-y-auto my-4 p-4 rounded-xl bg-surface-muted/50 font-mono text-sm leading-relaxed whitespace-pre-wrap">
              {loadingExecution ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <span className="text-xs font-semibold animate-pulse-soft">Generating draft, outlines, and research...</span>
                </div>
              ) : (
                executionResult
              )}
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              {executionResult && !loadingExecution && (
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(executionResult || "");
                    alert("Copied to clipboard!");
                  }}
                >
                  Copy to Clipboard
                </Button>
              )}
              <Button variant="secondary" onClick={() => setExecutingSubtask(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
