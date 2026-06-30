"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGoal, createHabit, completeHabit, updateGoalProgress } from "@/actions/goals";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  progress: number;
};

type Habit = {
  id: string;
  title: string;
  frequency: string;
  streak: number;
  bestStreak: number;
};

export function GoalsPanel({
  initialGoals,
  initialHabits,
}: {
  initialGoals: Goal[];
  initialHabits: Habit[];
}) {
  const router = useRouter();
  const [goals, setGoals] = useState(initialGoals);
  const [habits, setHabits] = useState(initialHabits);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [habitError, setHabitError] = useState<string | null>(null);

  async function handleGoalCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGoalError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const res = await createGoal(formData);
    if (res && "error" in res && res.error) {
      setGoalError(res.error);
    } else if (res && "goal" in res && res.goal) {
      setGoals((prev) => [res.goal as Goal, ...prev]);
      form.reset();
      router.refresh();
    }
  }

  async function handleHabitCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHabitError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const res = await createHabit(formData);
    if (res && "error" in res && res.error) {
      setHabitError(res.error);
    } else if (res && "habit" in res && res.habit) {
      setHabits((prev) => [res.habit as Habit, ...prev]);
      form.reset();
      router.refresh();
    }
  }

  async function handleHabitComplete(id: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const res = await completeHabit(id, start, end);
    if (res && "error" in res && res.error) {
      alert(res.error);
    } else if (res && "success" in res && res.success) {
      if ("alreadyCompleted" in res && res.alreadyCompleted) {
        alert("You already completed this habit today!");
        return;
      }
      setHabits((prev) =>
        prev.map((h) =>
          h.id === id
            ? { ...h, streak: res.streak ?? h.streak, bestStreak: res.bestStreak ?? h.bestStreak }
            : h
        ),
      );
      router.refresh();
    }
  }

  async function bumpProgress(id: string, current: number) {
    const next = Math.min(100, current + 10);
    await updateGoalProgress(id, next);
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, progress: next } : g)));
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Goals" subtitle="Long-term targets with progress tracking" />
        {goalError && (
          <p className="mb-2 text-xs text-critical font-medium">{goalError}</p>
        )}
        <form onSubmit={handleGoalCreate} className="mb-4 flex gap-2">
          <input
            name="title"
            required
            placeholder="New goal..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <Button type="submit">Add</Button>
        </form>
        <ul className="space-y-4">
          {goals.map((goal) => (
            <li key={goal.id} className="rounded-xl border border-border p-4">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium">{goal.title}</p>
                  {goal.description && (
                    <p className="text-sm text-muted mt-1">{goal.description}</p>
                  )}
                </div>
                <span className="font-mono text-sm text-muted">{goal.progress}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-surface-muted">
                <div
                  className="h-2 rounded-full bg-success transition-all"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => bumpProgress(goal.id, goal.progress)}
              >
                +10% progress
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Habits" subtitle="Build streaks that compound" />
        {habitError && (
          <p className="mb-2 text-xs text-critical font-medium">{habitError}</p>
        )}
        <form onSubmit={handleHabitCreate} className="mb-4 flex gap-2">
          <input
            name="title"
            required
            placeholder="New habit..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <Button type="submit">Add</Button>
        </form>
        <ul className="space-y-3">
          {habits.map((habit) => (
            <li
              key={habit.id}
              className="flex items-center justify-between rounded-xl border border-border p-4"
            >
              <div>
                <p className="font-medium">{habit.title}</p>
                <div className="mt-1 flex gap-2">
                  <Badge variant="success">{habit.streak} day streak</Badge>
                  <Badge variant="muted">Best: {habit.bestStreak}</Badge>
                </div>
              </div>
              <Button onClick={() => handleHabitComplete(habit.id)}>Done today</Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
