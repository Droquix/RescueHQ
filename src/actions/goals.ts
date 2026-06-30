"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { z } from "zod";

const goalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetDate: z.string().optional(),
});

export async function getGoals() {
  return db.goal.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createGoal(formData: FormData) {
  const parsed = goalSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    targetDate: formData.get("targetDate") || undefined,
  });
  if (!parsed.success) return { error: "Invalid goal" };

  const goal = await db.goal.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
    },
  });
  revalidatePath("/goals");
  return { success: true, goal };
}

export async function updateGoalProgress(id: string, progress: number) {
  await db.goal.update({
    where: { id },
    data: { progress: Math.min(100, Math.max(0, progress)) },
  });
  revalidatePath("/goals");
}

export async function getHabits() {
  return db.habit.findMany({
    include: { logs: { orderBy: { date: "desc" }, take: 7 } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createHabit(formData: FormData) {
  const title = formData.get("title") as string;
  if (!title?.trim()) return { error: "Title required" };

  const habit = await db.habit.create({
    data: {
      title: title.trim(),
      frequency: (formData.get("frequency") as string) || "daily",
    },
  });
  revalidatePath("/goals");
  return { success: true, habit };
}

export async function completeHabit(
  id: string,
  clientLocalDateStart: Date,
  clientLocalDateEnd: Date,
) {
  return db.$transaction(async (tx) => {
    const habit = await tx.habit.findUnique({ where: { id } });
    if (!habit) return { error: "Habit not found" };

    const existing = await tx.habitLog.findFirst({
      where: {
        habitId: id,
        date: {
          gte: clientLocalDateStart,
          lte: clientLocalDateEnd,
        },
      },
    });

    if (existing) return { success: true, alreadyCompleted: true };

    await tx.habitLog.create({ data: { habitId: id } });

    const newStreak = habit.streak + 1;
    const updated = await tx.habit.update({
      where: { id },
      data: {
        streak: newStreak,
        bestStreak: Math.max(habit.bestStreak, newStreak),
        lastCompleted: new Date(),
      },
    });

    revalidatePath("/goals");
    return { success: true, streak: updated.streak, bestStreak: updated.bestStreak };
  });
}
