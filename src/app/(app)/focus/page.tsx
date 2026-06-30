import { db } from "@/lib/db";
import { getTasks } from "@/actions/tasks";
import { FocusSession } from "@/components/tasks/focus-session";

export const dynamic = "force-dynamic";

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const { taskId } = await searchParams;
  const tasks = await db.task.findMany({
    where: { status: { in: ["pending", "at_risk"] } },
    include: { subtasks: { orderBy: { order: "asc" } } },
    orderBy: { urgencyScore: "desc" },
  });

  const activeTask = tasks.find((t) => t.id === taskId) || tasks[0] || null;

  return (
    <div className="space-y-6 animate-slide-up">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Focus Zone</h1>
        <p className="mt-1 text-muted">
          Eliminate distractions. Dive into a timed session with AI backing.
        </p>
      </header>
      <FocusSession initialTask={activeTask} allTasks={tasks} />
    </div>
  );
}
