import { getGoals, getHabits } from "@/actions/goals";
import { GoalsPanel } from "@/components/goals/goals-panel";
import { SeedButton } from "@/components/seed-button";

export default async function GoalsPage() {
  const goals = await getGoals();
  const habits = await getHabits();

  return (
    <div className="space-y-6 animate-slide-up">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Goals & Habits</h1>
          <p className="mt-1 text-muted">
            Track long-term progress and daily habits so urgent tasks don&apos;t eclipse what matters.
          </p>
        </div>
        <SeedButton />
      </header>
      <GoalsPanel initialGoals={goals} initialHabits={habits} />
    </div>
  );
}
