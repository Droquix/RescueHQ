"use server";

import { db } from "@/lib/db";
import { aiChat, aiRecommendations, aiMotivationBoost, aiExecuteSubtask } from "@/lib/ai";
import { getTasks } from "./tasks";

export async function chatWithAssistant(message: string) {
  const tasks = await getTasks();
  const result = await aiChat(message, {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      status: t.status,
      category: t.category,
    })),
  });

  const actionsTaken: string[] = [];
  if (result.actions && Array.isArray(result.actions)) {
    const { computeUrgencyScore } = await import("@/lib/prioritization");
    for (const action of result.actions) {
      try {
        if (action.type === "create_task") {
          const payload = action.payload;
          if (payload && payload.title) {
            const urgencyScore = computeUrgencyScore({
              id: "",
              title: payload.title,
              priority: payload.priority || "medium",
              dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
              estimatedMinutes: payload.estimatedMinutes || 30,
              status: "pending",
              category: payload.category || "general",
            });
            const task = await db.task.create({
              data: {
                title: payload.title,
                description: payload.description || "Created autonomously by AI Coach Agent.",
                priority: payload.priority || "medium",
                dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
                estimatedMinutes: payload.estimatedMinutes || 30,
                category: payload.category || "general",
                urgencyScore,
                aiReason: "Created autonomously based on chat input.",
              },
            });
            actionsTaken.push(`Created task "${payload.title}"`);
          }
        } else if (action.type === "complete_task") {
          const payload = action.payload;
          if (payload && payload.taskId) {
            await db.task.update({
              where: { id: payload.taskId },
              data: { status: "completed", completedAt: new Date() },
            });
            actionsTaken.push(`Completed task`);
          }
        } else if (action.type === "break_down_task") {
          const payload = action.payload;
          if (payload && payload.taskId) {
            const { breakDownTask } = await import("./tasks");
            await breakDownTask(payload.taskId);
            actionsTaken.push(`Broke down task into subtasks`);
          }
        } else if (action.type === "auto_schedule") {
          const { autoSchedule } = await import("./tasks");
          await autoSchedule();
          actionsTaken.push(`Scheduled today's time blocks`);
        }
      } catch (err) {
        console.error("Agent failed to execute action:", action, err);
      }
    }
  }

  if (actionsTaken.length > 0) {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/");
    revalidatePath("/tasks");
    revalidatePath("/calendar");
  }

  let finalResponse = result.response;
  if (actionsTaken.length > 0) {
    finalResponse += `\n\n[Agent Actions Executed: ${actionsTaken.join(", ")}]`;
  }

  return { response: finalResponse, actions: result.actions };
}

export async function getRecommendations() {
  const tasks = await getTasks();
  return aiRecommendations(
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
      status: t.status,
      category: t.category,
    })),
  );
}

export async function getScheduleBlocks() {
  return db.scheduleBlock.findMany({ orderBy: { startTime: "asc" } });
}

export async function getReminders() {
  return db.reminder.findMany({
    include: { task: true },
    orderBy: { scheduledFor: "asc" },
    take: 10,
  });
}

export async function seedContextReminders() {
  const tasks = await db.task.findMany({
    where: { status: { in: ["pending", "at_risk"] } },
    take: 5,
  });

  const contexts = [
    { context: "morning", message: "Morning focus block — tackle your highest urgency task first." },
    { context: "commute", message: "On the move? Review notes or send that quick follow-up email." },
    { context: "evening", message: "Evening check-in: what's still due before midnight?" },
  ];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const ctx = contexts[i % contexts.length];
    const scheduled = new Date();
    scheduled.setHours(scheduled.getHours() + i + 1);

    await db.reminder.create({
      data: {
        taskId: task.id,
        message: `${ctx.message} → "${task.title}"`,
        context: ctx.context,
        scheduledFor: scheduled,
      },
    });
  }

  return { count: tasks.length };
}

export async function getMotivationBoost(taskTitle: string, currentSubtask?: string) {
  const message = await aiMotivationBoost(taskTitle, currentSubtask);
  return { message };
}

export async function executeSubtaskAction(taskId: string, subtaskTitle: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  const result = await aiExecuteSubtask(
    task?.title || "Task Context",
    task?.description || "",
    subtaskTitle,
  );
  return { result };
}
