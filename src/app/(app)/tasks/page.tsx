import { getTasks } from "@/actions/tasks";
import { TaskBoard } from "@/components/tasks/task-board";
import { SeedButton } from "@/components/seed-button";

export default async function TasksPage() {
  const tasks = await getTasks();

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-1 text-muted">
            Intelligent prioritization and autonomous breakdown into actionable steps.
          </p>
        </div>
        <SeedButton />
      </header>
      <TaskBoard initialTasks={tasks} />
    </div>
  );
}
