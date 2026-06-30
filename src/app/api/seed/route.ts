import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeUrgencyScore } from "@/lib/prioritization";

/**
 * Demo seed tasks — every estimatedMinutes value is calibrated to the task scope:
 *
 * | Task                              | Why this duration |
 * |-----------------------------------|-------------------|
 * | Submit quarterly report           | 120 min — writing + formatting a Q2 report realistically |
 * | Prepare for client interview      | 90 min — portfolio review + pitch practice for 1 interview |
 * | Pay electricity bill              | 15 min — log in, enter card details, confirm |
 * | Finish React assignment           | 180 min — code, README, and Vercel deploy for a CS assignment |
 * | Team standup prep                 | 20 min — blockers + slide notes for next day |
 * | Set up website project structure  | 45 min — scoped to scaffolding only (not full build) |
 * | Gym — leg day                     | 60 min — realistic gym session |
 */
const sampleTasks = [
  {
    title: "Submit quarterly report",
    description: "Finance team needs Q2 numbers by EOD",
    priority: "critical",
    category: "deadline",
    estimatedMinutes: 120, // 2 hrs: write + format Q2 report
    hoursUntilDue: 3,
  },
  {
    title: "Prepare for client interview",
    description: "Review portfolio and practice pitch before the call",
    priority: "high",
    category: "interview",
    estimatedMinutes: 90, // 1.5 hrs: portfolio review + pitch run-through
    hoursUntilDue: 26,
  },
  {
    title: "Pay electricity bill",
    description: "Auto-pay failed — manual payment needed via bank portal",
    priority: "high",
    category: "bills",
    estimatedMinutes: 15, // 15 min: log in, enter card, confirm payment
    hoursUntilDue: 8,
  },
  {
    title: "Finish React assignment",
    description: "CS401 — complete remaining components, deploy to Vercel, write README",
    priority: "medium",
    category: "assignment",
    estimatedMinutes: 180, // 3 hrs: code + deploy + documentation
    hoursUntilDue: 48,
  },
  {
    title: "Team standup prep",
    description: "Note down blockers and sprint update for tomorrow morning's standup",
    priority: "medium",
    category: "meeting",
    estimatedMinutes: 20, // 20 min: bullet-point blockers and sprint notes
    hoursUntilDue: 20,
  },
  {
    title: "Set up website project structure",
    description: "Scaffold Next.js app, configure Tailwind, set up folder structure and push to GitHub",
    priority: "medium",
    category: "assignment",
    estimatedMinutes: 45, // 45 min: scoped to project scaffolding only
    hoursUntilDue: 36,
  },
  {
    title: "Gym — leg day",
    description: "Habit streak at 12 days — squats, lunges, leg press",
    priority: "low",
    category: "habit",
    estimatedMinutes: 60, // 60 min: realistic gym session
    hoursUntilDue: 10,
  },
];

async function wipeDb() {
  // Delete in dependency order to avoid FK constraint violations
  await db.reminder.deleteMany({});
  await db.scheduleBlock.deleteMany({});
  await db.subTask.deleteMany({});
  await db.task.deleteMany({});
  await db.habit.deleteMany({});
  await db.goal.deleteMany({});
}

async function seedDb() {
  for (const sample of sampleTasks) {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + sample.hoursUntilDue);

    const urgencyScore = computeUrgencyScore({
      id: "",
      title: sample.title,
      priority: sample.priority,
      dueDate,
      estimatedMinutes: sample.estimatedMinutes,
      status: "pending",
      category: sample.category,
    });

    await db.task.create({
      data: {
        title: sample.title,
        description: sample.description,
        priority: sample.priority,
        category: sample.category,
        estimatedMinutes: sample.estimatedMinutes,
        dueDate,
        urgencyScore,
        aiReason: "Seeded demo task",
      },
    });
  }

  await db.goal.createMany({
    data: [
      { title: "Launch side project", description: "Ship MVP by end of month", progress: 45 },
      { title: "Read 12 books this year", progress: 58 },
    ],
  });

  await db.habit.createMany({
    data: [
      { title: "Morning deep work", frequency: "daily", streak: 7, bestStreak: 14 },
      { title: "No social media before noon", frequency: "daily", streak: 3, bestStreak: 10 },
      { title: "Weekly planning session", frequency: "weekly", streak: 4, bestStreak: 8 },
    ],
  });

  const tasks = await db.task.findMany({ take: 3 });
  const contexts = ["morning", "commute", "evening"];
  for (let i = 0; i < tasks.length; i++) {
    const scheduled = new Date();
    scheduled.setHours(scheduled.getHours() + i + 1);
    await db.reminder.create({
      data: {
        taskId: tasks[i].id,
        message: `Context reminder: focus on "${tasks[i].title}" when you have a ${contexts[i]} window.`,
        context: contexts[i],
        scheduledFor: scheduled,
      },
    });
  }
}

/** POST /api/seed — seeds only if the DB is empty (idempotent guard) */
export async function POST() {
  const existing = await db.task.count();
  if (existing > 0) {
    return NextResponse.json({ message: "Already seeded", count: existing });
  }

  await seedDb();
  return NextResponse.json({ message: "Seeded successfully", tasks: sampleTasks.length });
}

/** DELETE /api/seed — wipes all data and re-seeds with clean demo data */
export async function DELETE() {
  await wipeDb();
  await seedDb();
  return NextResponse.json({ message: "Reset and re-seeded successfully", tasks: sampleTasks.length });
}
