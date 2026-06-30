import { differenceInHours, differenceInMinutes, isPast, isToday, isTomorrow } from "date-fns";

export type PriorityLevel = "critical" | "high" | "medium" | "low";

export interface TaskForScoring {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
  estimatedMinutes: number;
  status: string;
  category: string;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 40,
  high: 30,
  medium: 15,
  low: 5,
};

export function computeUrgencyScore(task: TaskForScoring): number {
  if (task.status === "completed" || task.status === "cancelled") return 0;

  let score = PRIORITY_WEIGHT[task.priority] ?? 15;

  if (task.dueDate) {
    const now = new Date();
    if (isPast(task.dueDate)) {
      score += 50;
    } else if (isToday(task.dueDate)) {
      const hoursLeft = differenceInHours(task.dueDate, now);
      score += 35 + Math.max(0, 10 - hoursLeft);
    } else if (isTomorrow(task.dueDate)) {
      score += 25;
    } else {
      const hoursLeft = differenceInHours(task.dueDate, now);
      if (hoursLeft <= 48) score += 20;
      else if (hoursLeft <= 168) score += 10;
    }
  }

  if (task.estimatedMinutes >= 120) score += 5;
  if (task.category === "deadline" || task.category === "interview") score += 10;

  return Math.min(100, Math.round(score));
}

export function getUrgencyLabel(score: number): string {
  if (score >= 80) return "Critical — act now";
  if (score >= 60) return "High urgency";
  if (score >= 40) return "Needs attention";
  if (score >= 20) return "On track";
  return "Low priority";
}

export function getUrgencyReason(task: TaskForScoring, score: number): string {
  if (task.dueDate && isPast(task.dueDate)) {
    return "Past deadline — immediate action required.";
  }
  if (task.dueDate && isToday(task.dueDate)) {
    const mins = differenceInMinutes(task.dueDate, new Date());
    if (mins <= 60) return `Due in ${mins} minutes — start immediately.`;
    return "Due today — prioritize before other work.";
  }
  if (task.dueDate && isTomorrow(task.dueDate)) {
    return "Due tomorrow — schedule a focused block today.";
  }
  if (task.priority === "critical") {
    return "Marked critical — don't let this slip.";
  }
  if (score >= 60) {
    return "High urgency score based on deadline proximity and effort.";
  }
  return "Steady progress keeps this from becoming last-minute.";
}

export function sortByUrgency<T extends TaskForScoring>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => computeUrgencyScore(b) - computeUrgencyScore(a));
}

export function suggestTimeBlocks(
  tasks: TaskForScoring[],
  startHour = 9,
): Array<{ title: string; taskId: string; start: Date; end: Date }> {
  const sorted = sortByUrgency(tasks.filter((t) => t.status === "pending" || t.status === "at_risk"));
  const blocks: Array<{ title: string; taskId: string; start: Date; end: Date }> = [];
  const base = new Date();
  base.setHours(startHour, 0, 0, 0);

  let cursor = new Date(base);

  for (const task of sorted.slice(0, 6)) {
    const duration = Math.min(task.estimatedMinutes, 90);
    const end = new Date(cursor.getTime() + duration * 60 * 1000);
    blocks.push({
      title: task.title,
      taskId: task.id,
      start: new Date(cursor),
      end,
    });
    cursor = new Date(end.getTime() + 15 * 60 * 1000);
  }

  return blocks;
}

export function isRescueModeRequired(tasks: TaskForScoring[]): boolean {
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "at_risk");
  
  // 1. Any overdue pending task triggers Rescue Mode immediately
  const overdue = pending.filter((t) => t.dueDate && isPast(new Date(t.dueDate)));
  if (overdue.length > 0) return true;

  const now = new Date();
  
  // 2. Any critical or high task due in next 18 hours
  const atRisk = pending.some((t) => {
    if (!t.dueDate) return false;
    const hoursLeft = differenceInHours(new Date(t.dueDate), now);
    return hoursLeft >= 0 && hoursLeft <= 18 && (t.priority === "critical" || t.priority === "high");
  });
  if (atRisk) return true;

  // 3. Or total estimated minutes due in the next 24 hours > 4 hours (240 mins)
  const dueWithin24 = pending.filter((t) => {
    if (!t.dueDate) return false;
    const hoursLeft = differenceInHours(new Date(t.dueDate), now);
    return hoursLeft >= 0 && hoursLeft <= 24;
  });
  const totalMins = dueWithin24.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  if (totalMins > 240) return true;

  return false;
}

export function suggestRescueBlocks(
  tasks: TaskForScoring[],
  startHour = 9,
): {
  blocks: Array<{ title: string; taskId: string; start: Date; end: Date }>;
  postponedCount: number;
  postponedTasks: TaskForScoring[];
} {
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "at_risk");
  const sorted = sortByUrgency(pending);
  
  // Postpone low-priority tasks (exclude them from active today blocks)
  const activeTasks = sorted.filter((t) => t.priority !== "low");
  const postponedTasks = sorted.filter((t) => t.priority === "low");

  const blocks: Array<{ title: string; taskId: string; start: Date; end: Date }> = [];
  const base = new Date();
  base.setHours(startHour, 0, 0, 0);

  let cursor = new Date(base);

  for (const task of activeTasks.slice(0, 6)) {
    const isTopTask = task.id === sorted[0]?.id;
    // Top task gets extra focus duration
    const duration = isTopTask 
      ? Math.min(task.estimatedMinutes * 2, 120) 
      : Math.min(task.estimatedMinutes, 90);

    const end = new Date(cursor.getTime() + duration * 60 * 1000);
    blocks.push({
      title: `${isTopTask ? "🚨 RESCUE: " : ""}${task.title}`,
      taskId: task.id,
      start: new Date(cursor),
      end,
    });
    cursor = new Date(end.getTime() + 15 * 60 * 1000);
  }

  return {
    blocks,
    postponedCount: postponedTasks.length,
    postponedTasks,
  };
}
