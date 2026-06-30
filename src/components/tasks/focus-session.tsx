"use client";

import { useState, useEffect, useRef } from "react";
import { formatMinutes } from "@/lib/utils";
import { toggleSubtask } from "@/actions/tasks";
import { getMotivationBoost, executeSubtaskAction } from "@/actions/ai";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles } from "lucide-react";

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
  subtasks: SubTask[];
};

export function FocusSession({
  initialTask,
  allTasks,
}: {
  initialTask: Task | null;
  allTasks: Task[];
}) {
  const [activeTask, setActiveTask] = useState<Task | null>(initialTask);
  const [subtasks, setSubtasks] = useState<SubTask[]>(initialTask?.subtasks || []);

  // Timer states
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"work" | "break">("work");
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);

  // Audio states
  const [audioType, setAudioType] = useState<"none" | "brown" | "rain">("none");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // AI coach states
  const [motivation, setMotivation] = useState<string | null>(null);
  const [loadingMotivation, setLoadingMotivation] = useState(false);

  // AI execution states
  const [executingSubtask, setExecutingSubtask] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [loadingExecution, setLoadingExecution] = useState(false);

  // Sync subtasks and time when active task changes or durations change
  useEffect(() => {
    if (activeTask) {
      setSubtasks(activeTask.subtasks || []);
      setTimeLeft(mode === "work" ? workMinutes * 60 : breakMinutes * 60);
      setIsRunning(false);
      setMotivation(null);
    } else {
      setSubtasks([]);
    }
  }, [activeTask, mode, workMinutes, breakMinutes]);

  // Pomodoro countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      playBell();
      if (mode === "work") {
        alert(`Focus block finished! Take a ${breakMinutes}-minute break.`);
        setMode("break");
        setTimeLeft(breakMinutes * 60);
      } else {
        alert("Break is over! Ready to focus?");
        setMode("work");
        setTimeLeft(workMinutes * 60);
      }
      setIsRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, mode, workMinutes, breakMinutes]);

  // Audio player cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // Play synthetic focus block completion bell
  function playBell() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {
      console.error(e);
    }
  }

  // Play background sound from files
  function startAudio(type: "brown" | "rain") {
    stopAudio();

    try {
      const audio = new Audio(`/audio/${type}.mp3`);
      audio.loop = true;
      audio.volume = 0.5; // set a comfortable default volume
      audioRef.current = audio;
      audio.play().catch((err) => {
        console.error("Audio playback failed:", err);
      });
      setAudioType(type);
    } catch (e) {
      console.error("Failed to play audio file:", e);
    }
  }

  function stopAudio() {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch (e) {}
      audioRef.current = null;
    }
    setAudioType("none");
  }

  // Toggle subtasks checking
  async function handleToggleSub(subId: string, completed: boolean) {
    await toggleSubtask(subId, completed);
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, completed } : s))
    );
  }

  // Ask coach for motivation
  async function handleGetBoost() {
    if (!activeTask) return;
    setLoadingMotivation(true);
    setMotivation(null);
    try {
      const currentSub = subtasks.find((s) => !s.completed)?.title;
      const res = await getMotivationBoost(activeTask.title, currentSub);
      setMotivation(res.message);
    } catch (e) {
      setMotivation("You're making progress just by sitting here in the zone. Let's finish the next step!");
    } finally {
      setLoadingMotivation(false);
    }
  }

  // AI Autonomous Subtask Execution
  async function handleExecuteSubtask(subTitle: string) {
    if (!activeTask) return;
    setExecutingSubtask(subTitle);
    setLoadingExecution(true);
    setExecutionResult(null);
    try {
      const res = await executeSubtaskAction(activeTask.id, subTitle);
      setExecutionResult(res.result || "Execution completed.");
    } catch (e) {
      setExecutionResult("Failed to execute subtask.");
    } finally {
      setLoadingExecution(false);
    }
  }

  // Format MM:SS
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (!activeTask) {
    return (
      <Card className="p-8 text-center bg-surface">
        <p className="text-muted text-sm">No pending tasks found. Add a task to start a Focus Session!</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Immersive Timer Card */}
      <Card className="lg:col-span-2 flex flex-col justify-between items-center text-center p-8 bg-surface border-border min-h-[480px]">
        <div className="w-full flex justify-between items-center">
          <Badge variant={mode === "work" ? "critical" : "success"} className="capitalize px-3 py-1 text-sm font-semibold">
            {mode === "work" ? "🔥 Focus Block" : "☕ Break Mode"}
          </Badge>
          <div className="flex gap-2">
            <button
              onClick={() => (audioType === "brown" ? stopAudio() : startAudio("brown"))}
              className={`rounded-lg border border-border p-2 text-xs font-semibold flex items-center gap-1 transition-colors ${
                audioType === "brown" ? "bg-accent/10 border-accent/30 text-accent" : "hover:bg-surface-muted"
              }`}
            >
              <Volume2 className="h-3.5 w-3.5" />
              Brown Noise
            </button>
            <button
              onClick={() => (audioType === "rain" ? stopAudio() : startAudio("rain"))}
              className={`rounded-lg border border-border p-2 text-xs font-semibold flex items-center gap-1 transition-colors ${
                audioType === "rain" ? "bg-accent/10 border-accent/30 text-accent" : "hover:bg-surface-muted"
              }`}
            >
              <Volume2 className="h-3.5 w-3.5" />
              Rain Static
            </button>
            {audioType !== "none" && (
              <button onClick={stopAudio} className="p-2 border border-border rounded-lg hover:bg-surface-muted">
                <VolumeX className="h-3.5 w-3.5 text-muted" />
              </button>
            )}
          </div>
        </div>

        {/* The Big Timer */}
        <div className="my-8">
          <span className="font-mono text-8xl font-bold tracking-tight text-foreground select-none">
            {timeString}
          </span>
          <p className="mt-2 text-sm text-muted font-medium">
            Focusing on: <strong className="text-foreground">{activeTask.title}</strong>
          </p>
        </div>

        {/* Duration configuration settings */}
        <div className="flex gap-6 my-4 text-xs text-muted font-medium bg-surface-muted/60 px-4 py-2.5 rounded-xl border border-border/40 select-none">
          <div className="flex items-center gap-2">
            <span>Work Time:</span>
            <input
              type="number"
              min={1}
              max={180}
              value={workMinutes}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 25);
                setWorkMinutes(val);
                if (mode === "work" && !isRunning) {
                  setTimeLeft(val * 60);
                }
              }}
              className="w-12 rounded border border-border bg-background px-1.5 py-0.5 text-center text-foreground font-semibold"
            />
            <span>mins</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Break Time:</span>
            <input
              type="number"
              min={1}
              max={60}
              value={breakMinutes}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 5);
                setBreakMinutes(val);
                if (mode === "break" && !isRunning) {
                  setTimeLeft(val * 60);
                }
              }}
              className="w-12 rounded border border-border bg-background px-1.5 py-0.5 text-center text-foreground font-semibold"
            />
            <span>mins</span>
          </div>
        </div>

        {/* Timer Control Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={() => setIsRunning(!isRunning)}
            className="px-8 py-3 text-base flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Pause className="h-5 w-5 fill-white" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-5 w-5 fill-white" />
                Start Focus
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setIsRunning(false);
              setTimeLeft(mode === "work" ? workMinutes * 60 : breakMinutes * 60);
            }}
            className="p-3"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </Card>

      {/* Task Context & AI Coaching Side-Panel */}
      <div className="space-y-6">
        {/* Task Selection Panel */}
        <Card className="p-5">
          <CardHeader title="Switch Task" subtitle="Select your current target" />
          <select
            value={activeTask.id}
            onChange={(e) => {
              const selected = allTasks.find((t) => t.id === e.target.value);
              if (selected) {
                setActiveTask(selected);
              }
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {allTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.urgencyScore} Urgency)
              </option>
            ))}
          </select>
        </Card>

        {/* Steps Checkoff */}
        <Card className="p-5">
          <CardHeader title="Action Steps" subtitle="AI breakdown checklist" />
          {subtasks.length === 0 ? (
            <p className="text-xs text-muted">No subtasks yet. Click "AI breakdown" in Tasks page to generate.</p>
          ) : (
            <ul className="space-y-2.5">
              {subtasks.map((sub) => (
                <li key={sub.id} className="flex items-center justify-between gap-2.5 text-sm w-full">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={sub.completed}
                      onChange={(e) => handleToggleSub(sub.id, e.target.checked)}
                      className="mt-0.5 rounded border-border"
                    />
                    <span className={sub.completed ? "text-muted line-through truncate" : "text-foreground truncate"}>
                      {sub.title}
                    </span>
                  </div>
                  {!sub.completed && (
                    <button
                      onClick={() => handleExecuteSubtask(sub.title)}
                      className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline shrink-0"
                    >
                      <Sparkles className="h-2.5 w-2.5 animate-pulse text-accent" />
                      Execute
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Motivation Boost Panel */}
        <Card className="p-5 bg-gradient-to-br from-accent/5 to-surface border border-accent/10">
          <CardHeader title="AI Focus Coach" subtitle="Real-time support when you need it" />
          <Button
            variant="secondary"
            onClick={handleGetBoost}
            disabled={loadingMotivation}
            className="w-full text-xs font-semibold py-2.5 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
            Get AI Motivation Boost
          </Button>

          {loadingMotivation && (
            <p className="mt-4 text-xs text-muted animate-pulse-soft text-center">Formulating response...</p>
          )}

          {motivation && (
            <div className="mt-4 rounded-xl bg-surface-muted/50 p-4 border border-border/40 text-xs leading-relaxed text-foreground animate-slide-up relative">
              <span className="absolute -top-2 left-6 w-3 h-3 bg-surface-muted rotate-45 border-l border-t border-border/40"></span>
              {motivation}
            </div>
          )}
        </Card>
      </div>

      {/* Autonomous Subtask Execution Modal */}
      {executingSubtask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col justify-between overflow-hidden text-left">
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
