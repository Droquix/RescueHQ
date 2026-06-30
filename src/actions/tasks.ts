"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { aiBreakDownTask, aiPrioritizeTasks, aiGenerateFeasibilityPlan } from "@/lib/ai";
import { computeUrgencyScore } from "@/lib/prioritization";
import { z } from "zod";
import { differenceInMinutes } from "date-fns";

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  dueDate: z.string().optional(),
  estimatedMinutes: z.coerce.number().min(5).max(480).default(30),
  category: z.string().default("general"),
  contextTags: z.array(z.string()).default([]),
});

async function checkAndApplyFeasibility(tasks: any[]) {
  const now = new Date();
  const updatedTasks = [...tasks];

  for (let i = 0; i < updatedTasks.length; i++) {
    const task = updatedTasks[i];
    if (task.status !== "pending" && task.status !== "at_risk") {
      continue;
    }

    let targetStatus = "pending";
    let minutesRemaining = 0;
    if (task.dueDate) {
      minutesRemaining = differenceInMinutes(new Date(task.dueDate), now);
      if (task.estimatedMinutes > minutesRemaining) {
        targetStatus = "at_risk";
      }
    }

    if (targetStatus === "at_risk") {
      const hasPlan = task.feasibilityPlan && task.feasibilityPlan.trim().length > 0;
      if (task.status !== "at_risk" || !hasPlan) {
        let planJson = null;
        try {
          const plan = await aiGenerateFeasibilityPlan(
            {
              title: task.title,
              description: task.description,
              estimatedMinutes: task.estimatedMinutes,
              dueDate: task.dueDate,
            },
            minutesRemaining
          );
          if (plan) {
            planJson = JSON.stringify(plan);
          }
        } catch (e) {
          console.error("Failed to generate feasibility plan:", e);
        }

        const updated = await db.task.update({
          where: { id: task.id },
          data: {
            status: "at_risk",
            feasibilityPlan: planJson,
          },
          include: { subtasks: { orderBy: { order: "asc" } } },
        });
        updatedTasks[i] = updated;
      }
    } else {
      if (task.status === "at_risk") {
        const updated = await db.task.update({
          where: { id: task.id },
          data: {
            status: "pending",
            feasibilityPlan: null,
          },
          include: { subtasks: { orderBy: { order: "asc" } } },
        });
        updatedTasks[i] = updated;
      }
    }
  }

  return updatedTasks;
}

export async function getTasks() {
  const tasks = await db.task.findMany({
    include: { subtasks: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return await checkAndApplyFeasibility(tasks);
}

export async function getPrioritizedTasks() {
  const tasks = await getTasks();
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "at_risk");

  // Only call AI if a pending task doesn't have a reason, has a default seed reason, or has a rule-based fallback reason (not starting with bullet •)
  const needsAiPrioritization = pending.some(
    (t) => !t.aiReason || t.aiReason === "Seeded demo task" || !t.aiReason.trim().startsWith("•")
  );

  let prioritized;
  if (needsAiPrioritization) {
    prioritized = await aiPrioritizeTasks(pending);
    for (const task of prioritized) {
      await db.task.update({
        where: { id: task.id },
        data: { urgencyScore: task.urgencyScore, aiReason: task.aiReason },
      });
    }
  } else {
    // Recompute score locally to reflect time elapsed, but preserve AI reasons
    prioritized = pending.map((t) => {
      const score = computeUrgencyScore({
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueDate: t.dueDate,
        estimatedMinutes: t.estimatedMinutes,
        status: t.status,
        category: t.category,
      });
      return {
        ...t,
        urgencyScore: score,
      };
    });
    prioritized.sort((a, b) => b.urgencyScore - a.urgencyScore);
    
    for (const task of prioritized) {
      await db.task.update({
        where: { id: task.id },
        data: { urgencyScore: task.urgencyScore },
      });
    }
  }

  return prioritized;
}

export async function createTask(formData: FormData) {
  const raw = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    priority: (formData.get("priority") as string) || "medium",
    dueDate: (formData.get("dueDate") as string) || undefined,
    estimatedMinutes: formData.get("estimatedMinutes") || "30",
    category: (formData.get("category") as string) || "general",
    contextTags: formData.get("contextTags")
      ? (formData.get("contextTags") as string).split(",").map((t) => t.trim()).filter(Boolean)
      : [],
  };

  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid task data" };

  const data = parsed.data;
  const urgencyScore = computeUrgencyScore({
    id: "",
    title: data.title,
    priority: data.priority,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    estimatedMinutes: data.estimatedMinutes,
    status: "pending",
    category: data.category,
  });

  const task = await db.task.create({
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedMinutes: data.estimatedMinutes,
      category: data.category,
      contextTags: JSON.stringify(data.contextTags),
      urgencyScore,
    },
  });

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  return { success: true, task };
}

export async function updateTaskStatus(id: string, status: string) {
  await db.task.update({
    where: { id },
    data: {
      status,
      completedAt: status === "completed" ? new Date() : null,
    },
  });
  revalidatePath("/");
  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  await db.task.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/tasks");
}

export async function breakDownTask(id: string) {
  const task = await db.task.findUnique({ where: { id } });
  if (!task) return { error: "Task not found" };

  const subtasks = await aiBreakDownTask(task.title, task.description ?? undefined);
  await db.subTask.deleteMany({ where: { taskId: id } });

  const createdSubtasks = [];
  for (const sub of subtasks) {
    const created = await db.subTask.create({
      data: { taskId: id, title: sub.title, order: sub.order },
    });
    createdSubtasks.push(created);
  }

  revalidatePath("/tasks");
  return { success: true, subtasks: createdSubtasks };
}

export async function toggleSubtask(id: string, completed: boolean) {
  await db.subTask.update({ where: { id }, data: { completed } });
  revalidatePath("/tasks");
}

export async function autoSchedule() {
  const tasks = await getTasks();
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "at_risk");
  const { suggestTimeBlocks } = await import("@/lib/prioritization");
  const blocks = suggestTimeBlocks(pending);

  await db.scheduleBlock.deleteMany({ where: { aiGenerated: true } });

  for (const block of blocks) {
    await db.scheduleBlock.create({
      data: {
        taskId: block.taskId,
        title: block.title,
        startTime: block.start,
        endTime: block.end,
        aiGenerated: true,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  return { success: true, count: blocks.length };
}

export async function autoScheduleAction() {
  await autoSchedule();
}

export async function getAnalytics() {
  const allTasks = await db.task.findMany({ orderBy: { createdAt: "desc" } });

  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.status === "completed");
  const pending = allTasks.filter((t) => t.status === "pending" || t.status === "at_risk");
  const overdue = pending.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());

  // On-time: completed before or on their due date
  const onTime = completed.filter(
    (t) => t.dueDate && t.completedAt && new Date(t.completedAt) <= new Date(t.dueDate),
  );

  // Time saved estimate: sum of estimatedMinutes for tasks completed on time
  const timeSavedMinutes = onTime.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  // Completion rate
  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  // On-time rate (of completed tasks)
  const onTimeRate =
    completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 0;

  // Category breakdown of pending tasks
  const categoryMap: Record<string, number> = {};
  for (const t of pending) {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + 1;
  }

  // Recent completions (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentCompletions = completed.filter(
    (t) => t.completedAt && new Date(t.completedAt) >= sevenDaysAgo,
  ).length;

  return {
    total,
    completed: completed.length,
    pending: pending.length,
    overdue: overdue.length,
    onTime: onTime.length,
    timeSavedMinutes,
    completionRate,
    onTimeRate,
    categoryBreakdown: categoryMap,
    recentCompletions,
  };
}

export async function getRescueState() {
  const tasks = await getTasks();
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "at_risk");

  const { isRescueModeRequired, suggestRescueBlocks } = await import("@/lib/prioritization");
  const isActive = isRescueModeRequired(pending);

  if (!isActive) {
    return { isActive: false };
  }

  // Find the single most critical pending task (highest urgency score)
  const sortedPending = [...pending].sort((a, b) => b.urgencyScore - a.urgencyScore);
  const criticalTask = sortedPending[0];

  if (!criticalTask) {
    return { isActive: false };
  }

  // Get the Rescue blocks and postponed tasks list
  const { blocks, postponedCount, postponedTasks } = suggestRescueBlocks(pending);

  // Autonomous Rescheduling: Re-write the today blocks database table!
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Check if we already have AI-generated schedule blocks matching this configuration to avoid writing redundantly
  const existingRescueBlock = await db.scheduleBlock.findFirst({
    where: {
      aiGenerated: true,
      title: { startsWith: "🚨 RESCUE:" },
      startTime: { gte: todayStart, lte: todayEnd },
    },
  });

  if (!existingRescueBlock) {
    // Write new blocks to the database autonomously!
    await db.scheduleBlock.deleteMany({
      where: {
        aiGenerated: true,
        startTime: { gte: todayStart, lte: todayEnd },
      },
    });

    for (const b of blocks) {
      await db.scheduleBlock.create({
        data: {
          taskId: b.taskId,
          title: b.title,
          startTime: b.start,
          endTime: b.end,
          aiGenerated: true,
        },
      });
    }
  }

  // Fetch the active today schedule blocks
  const dbBlocks = await db.scheduleBlock.findMany({
    where: { startTime: { gte: todayStart, lte: todayEnd } },
    orderBy: { startTime: "asc" },
  });

  // Call Gemini to generate the dynamic rescue explanation
  const { aiGenerateRescuePlan, aiGenerateComparativeReasoning } = await import("@/lib/ai");
  const explanation = await aiGenerateRescuePlan(
    {
      title: criticalTask.title,
      priority: criticalTask.priority,
      dueDate: criticalTask.dueDate,
    },
    pending.length,
    postponedCount,
  );

  // Build the top 3-5 tasks for comparative reasoning (highest urgency first)
  const topTasksForRanking = sortedPending.slice(0, Math.min(5, sortedPending.length)).map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    estimatedMinutes: t.estimatedMinutes,
    urgencyScore: t.urgencyScore,
  }));

  // Only run comparative reasoning when there are at least 2 tasks to compare
  const comparativeRankings =
    topTasksForRanking.length >= 2
      ? await aiGenerateComparativeReasoning(topTasksForRanking)
      : [];

  return {
    isActive: true,
    criticalTask: {
      id: criticalTask.id,
      title: criticalTask.title,
      priority: criticalTask.priority,
      dueDate: criticalTask.dueDate,
      estimatedMinutes: criticalTask.estimatedMinutes,
      category: criticalTask.category,
      urgencyScore: criticalTask.urgencyScore,
      aiReason: criticalTask.aiReason,
    },
    explanation,
    comparativeRankings,
    postponedCount,
    postponedTasks: postponedTasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority })),
    reservedBlocks: dbBlocks.map((b) => ({
      id: b.id,
      title: b.title,
      startTime: b.startTime,
      endTime: b.endTime,
    })),
  };
}

