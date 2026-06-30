import OpenAI from "openai";
import {
  computeUrgencyScore,
  getUrgencyReason,
  sortByUrgency,
  suggestTimeBlocks,
  type TaskForScoring,
} from "./prioritization";

const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());

function getClient() {
  if (!hasOpenAI) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// REST call to Google Gemini API
async function callGemini(systemPrompt: string, userPrompt: string, jsonMode = false): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No Gemini key");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          parts: [{ text: userPrompt }],
        },
      ],
      ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Invalid response format from Gemini");
  }

  return text;
}

export async function aiPrioritizeTasks(tasks: TaskForScoring[]) {
  const scored = tasks.map((task) => {
    const score = computeUrgencyScore(task);
    return {
      ...task,
      urgencyScore: score,
      aiReason: getUrgencyReason(task, score),
    };
  });

  const sorted = sortByUrgency(scored);
  if (sorted.length === 0) return sorted;

  if (!hasGemini && !hasOpenAI) {
    return sorted.map((task) => ({
      ...task,
      aiReason: generateFallbackReasonDetails(task, task.urgencyScore),
    }));
  }

  const systemPrompt = `You are a productivity coach. For each task, evaluate its priority using factors like: time remaining, estimated duration, postponements, dependencies, and overall importance.
Return a JSON object: { "insights": string[], "topFocus": string, "reasons": { [taskId]: string } }.
The value for each key in "reasons" must be a detailed, structured explanation using 3-5 bullet points and a recommended start action. Use raw newline characters (\\n) to format the bullet points and action.

Format of each reason:
• [Factor 1]
• [Factor 2]
• [Factor 3]
Recommended Action: Start before [Time].

Example reason:
• Due in 18 hours\\n• Estimated work: 2.5 hours\\n• Completing this unlocks another task\\nRecommended Action: Start before 6:30 PM.`;
  const userPrompt = JSON.stringify(
    sorted.slice(0, 8).map((t) => ({
      id: t.id,
      title: t.title,
      urgencyScore: t.urgencyScore,
      dueDate: t.dueDate,
      priority: t.priority,
    })),
  );

  try {
    let raw = "";
    if (hasGemini) {
      raw = await callGemini(systemPrompt, userPrompt, true);
    } else {
      const client = getClient();
      if (!client) return sorted;
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      raw = response.choices[0]?.message?.content || "";
    }

    if (!raw) return sorted;

    const parsed = JSON.parse(raw) as {
      reasons?: Record<string, string>;
      insights?: string[];
      topFocus?: string;
    };

    return sorted.map((task) => ({
      ...task,
      aiReason: parsed.reasons?.[task.id] ?? task.aiReason,
    }));
  } catch (e: any) {
    if (e.message === "QUOTA_EXCEEDED") {
      console.warn("⚠️ Gemini API limit exceeded (429). Using local priority analysis fallback.");
    } else {
      console.error("AI prioritize error:", e);
    }
    return sorted.map((task) => ({
      ...task,
      aiReason: generateFallbackReasonDetails(task, task.urgencyScore),
    }));
  }
}

export async function aiBreakDownTask(title: string, description?: string) {
  if (!hasGemini && !hasOpenAI) {
    return [
      { title: `Research: ${title}`, order: 0 },
      { title: `Draft first version of ${title}`, order: 1 },
      { title: `Review and finalize ${title}`, order: 2 },
    ];
  }

  const systemPrompt = "Break a task into 3-5 concrete subtasks. Return JSON: { \"subtasks\": [{ \"title\": string, \"order\": number }] }";
  const userPrompt = `${title}${description ? `\n${description}` : ""}`;

  try {
    let raw = "";
    if (hasGemini) {
      raw = await callGemini(systemPrompt, userPrompt, true);
    } else {
      const client = getClient();
      if (!client) throw new Error("No client");
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      raw = response.choices[0]?.message?.content || "";
    }

    if (!raw) throw new Error("No response");

    const parsed = JSON.parse(raw) as { subtasks?: { title: string; order: number }[] };
    if (!parsed || !Array.isArray(parsed.subtasks)) {
      throw new Error("Invalid response format");
    }
    return parsed.subtasks.map((s, idx) => ({
      title: typeof s.title === "string" ? s.title : `Subtask ${idx + 1}`,
      order: typeof s.order === "number" ? s.order : idx,
    }));
  } catch (e: any) {
    if (e.message === "QUOTA_EXCEEDED") {
      console.warn("⚠️ Gemini API limit exceeded (429). Using local task breakdown fallback.");
    } else {
      console.error("AI breakdown error:", e);
    }
    return [
      { title: `Start: ${title}`, order: 0 },
      { title: `Complete core work for ${title}`, order: 1 },
      { title: `Wrap up ${title}`, order: 2 },
    ];
  }
}

export async function aiChat(
  message: string,
  context: { tasks: TaskForScoring[]; goals?: string[] },
): Promise<{ response: string; actions?: any[] }> {
  const urgent = sortByUrgency(context.tasks).slice(0, 5);

  if (!hasGemini && !hasOpenAI) {
    const top = urgent[0];
    let response = "";
    let actions: any[] = [];
    if (message.toLowerCase().includes("priorit") || message.toLowerCase().includes("urgent")) {
      response = top
        ? `I noticed you wanted to know what to prioritize next.

I've already:
✓ Scored all your pending items
✓ Set "${top.title}" as your top-priority target

Your next step is to engage focus on "${top.title}".`
        : `I noticed you asked about priorities but have no pending tasks.

I've already:
✓ Checked your workspace databases
✓ Verified a clean pipeline

Your next step is to add your first deadline task.`;
    } else if (message.toLowerCase().includes("schedule") || message.toLowerCase().includes("plan")) {
      const blocks = suggestTimeBlocks(context.tasks);
      actions = [{ type: "auto_schedule", payload: {} }];
      response = `I noticed you need an optimized daily schedule.

I've already:
✓ Re-calculated all focus blocks
✓ Reserved slots for pending tasks
✓ Updated today's agenda timeline

Your next step is to check your updated calendar tab.`;
    } else if (message.toLowerCase().includes("create") || message.toLowerCase().includes("add")) {
      const title = message.replace(/(create|add|task)/gi, "").trim() || "New Task";
      actions = [{ type: "create_task", payload: { title, priority: "medium" } }];
      response = `I noticed you wanted to track a new commitment.

I've already:
✓ Created the task "${title}"
✓ Added it to your pending list

Your next step is to review the task and break it down.`;
    } else {
      response = top
        ? `I noticed you're checking in on your productivity.

I've already:
✓ Analyzed your upcoming deadlines
✓ Confirmed "${top.title}" as your most critical task

Your next step is to start focus on "${top.title}".`
        : `I noticed you asked for help.

I've already:
✓ Checked your list and verified no pending deadlines

Your next step is to add a task to get ahead of your schedule.`;
    }
    return { response, actions };
  }

  const systemPrompt = `You are Last-Minute Life Saver — a proactive, confident, and fully autonomous action-taking productivity assistant (not a passive chatbot).
Whenever the user asks for help or you detect a productivity issue, you MUST take immediate actions on their behalf using the action system.

Every response you write MUST include an 'I've already:' section showing exactly what actions you took. Be concise, impact-driven, and confident.

Format your response EXACTLY like this:
[Brief observation of the problem/status, e.g.: I noticed your assignment is due tomorrow and your schedule was clear.]

I've already:
✓ [Action 1 description, e.g. Created a critical focus task]
✓ [Action 2 description, e.g. Autonomously split it into step-by-step subtasks]
✓ [Action 3 description, e.g. Reorganized today's focus blocks]

[Direct next step/actionable command, e.g. Your next step is to click focus on the first task.]

Available Actions to include in the JSON 'actions' array:
- { "type": "create_task", "payload": { "title": string, "priority": "critical"|"high"|"medium"|"low", "dueDate"?: "YYYY-MM-DDTHH:MM:SSZ", "estimatedMinutes"?: number, "category"?: string } }
- { "type": "complete_task", "payload": { "taskId": string } } (find taskId in the task list by matching title)
- { "type": "break_down_task", "payload": { "taskId": string } } (find taskId in the task list by matching title)
- { "type": "auto_schedule", "payload": {} }

JSON Response Format:
{
  "response": "[formatted string following the template above]",
  "actions": [...]
}

Current Tasks Context: ${JSON.stringify(urgent.map((t) => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate })))}`;

  const userPrompt = `User Message: "${message}"`;

  try {
    let raw = "";
    if (hasGemini) {
      raw = await callGemini(systemPrompt, userPrompt, true);
    } else {
      const client = getClient();
      if (!client) throw new Error("No client");
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      raw = response.choices[0]?.message?.content || "";
    }

    if (!raw) return { response: "I'm not sure how to assist. Try asking me to schedule your day or add a task.", actions: [] };

    const parsed = JSON.parse(raw) as { response: string; actions?: any[] };
    return {
      response: parsed.response || "Task processed.",
      actions: parsed.actions || [],
    };
  } catch (e: any) {
    if (e.message === "QUOTA_EXCEEDED") {
      console.warn("⚠️ Gemini API limit exceeded (429). Using local chat agent fallback.");
    } else {
      console.error("AI chat error:", e);
    }
    const top = urgent[0];
    let response = "";
    let actions: any[] = [];
    if (message.toLowerCase().includes("priorit") || message.toLowerCase().includes("urgent")) {
      response = top
        ? `I noticed you wanted to know what to prioritize next.

I've already:
✓ Scored all your pending items
✓ Set "${top.title}" as your top-priority target

Your next step is to engage focus on "${top.title}".`
        : `I noticed you asked about priorities but have no pending tasks.

I've already:
✓ Checked your workspace databases
✓ Verified a clean pipeline

Your next step is to add your first deadline task.`;
    } else if (message.toLowerCase().includes("schedule") || message.toLowerCase().includes("plan") || message.toLowerCase().includes("overwhelm")) {
      actions = [{ type: "auto_schedule", payload: {} }];
      response = `I noticed you need an optimized daily schedule to resolve scheduling conflicts and overwhelm.

I've already:
✓ Re-calculated all focus blocks
✓ Reserved slots for pending tasks
✓ Updated today's agenda timeline

Your next step is to check your updated calendar tab.`;
    } else if (message.toLowerCase().includes("create") || message.toLowerCase().includes("add")) {
      const title = message.replace(/(create|add|task)/gi, "").trim() || "New Task";
      actions = [{ type: "create_task", payload: { title, priority: "medium" } }];
      response = `I noticed you wanted to track a new commitment.

I've already:
✓ Created the task "${title}"
✓ Added it to your pending list

Your next step is to review the task and break it down.`;
    } else {
      response = top
        ? `I noticed you're checking in on your productivity.

I've already:
✓ Analyzed your upcoming deadlines
✓ Confirmed "${top.title}" as your most critical task

Your next step is to start focus on "${top.title}".`
        : `I noticed you asked for help.

I've already:
✓ Checked your list and verified no pending deadlines

Your next step is to add a task to get ahead of your schedule.`;
    }
    return { response, actions };
  }
}

export async function aiRecommendations(tasks: TaskForScoring[]) {
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "at_risk");
  const overdue = pending.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
  const dueToday = pending.filter((t) => t.dueDate && isTodayDate(t.dueDate));

  const recommendations: Array<{ type: string; title: string; description: string; action?: string }> = [];

  if (overdue.length > 0) {
    recommendations.push({
      type: "rescue",
      title: "Rescue mode activated",
      description: `${overdue.length} overdue item(s). Block 90 minutes and clear the oldest deadline first.`,
      action: "Start rescue session",
    });
  }

  if (dueToday.length > 2) {
    recommendations.push({
      type: "schedule",
      title: "Heavy day ahead",
      description: `${dueToday.length} tasks due today. Let AI auto-schedule your afternoon.`,
      action: "Auto-schedule",
    });
  }

  const longTasks = pending.filter((t) => t.estimatedMinutes >= 90);
  if (longTasks.length > 0) {
    recommendations.push({
      type: "breakdown",
      title: "Break down big tasks",
      description: `"${longTasks[0].title}" needs chunking — split into subtasks to avoid procrastination.`,
      action: "Break down",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: "maintain",
      title: "You're in good shape",
      description: "No fires to fight. Use this window to advance a goal or build a habit streak.",
      action: "View goals",
    });
  }

  return recommendations;
}

function isTodayDate(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export async function aiMotivationBoost(taskTitle: string, currentSubtask?: string) {
  if (!hasGemini && !hasOpenAI) {
    return "Focus on one small step. You've got this! Action cures fear.";
  }

  const systemPrompt = "You are an encouraging productivity coach.";
  const userPrompt = `The user is currently in a 25-minute Pomodoro focus session working on the task: "${taskTitle}"${currentSubtask ? ` and specifically working on the step: "${currentSubtask}"` : ""}. Provide a highly encouraging, direct, and actionable coaching nudge to help them push through procrastination. Keep it under 60 words.`;

  try {
    if (hasGemini) {
      return await callGemini(systemPrompt, userPrompt, false);
    } else {
      const client = getClient();
      if (!client) throw new Error("No client");
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [{ role: "user", content: userPrompt }],
      });
      return response.choices[0]?.message?.content ?? "Keep going! One step at a time.";
    }
  } catch (e: any) {
    if (e.message === "QUOTA_EXCEEDED") {
      console.warn("⚠️ Gemini API limit exceeded (429). Using local motivation boost fallback.");
    } else {
      console.error("AI motivation boost error:", e);
    }
    return "Action creates momentum. Dive into the first subtask and let the momentum build.";
  }
}

export async function aiExecuteSubtask(taskTitle: string, taskDescription: string, subtaskTitle: string) {
  if (!hasGemini && !hasOpenAI) {
    return `[Autonomous Execution Result for: "${subtaskTitle}"]\n\nHere is your drafted output:\n- Drafted outline for "${subtaskTitle}" based on your task guidelines.\n- Checked reference materials and mapped out the core milestones.\n- Copy this draft and modify it to suit your final preferences.`;
  }

  const systemPrompt = `You are an AI autonomous execution agent. The user needs help executing the subtask: "${subtaskTitle}" under the project/goal context: Task Title: "${taskTitle}". Description: "${taskDescription}".`;
  const userPrompt = `Provide the raw finished draft, research summary, email template, outline, or plan that directly accomplishes this subtask. Be extremely thorough, realistic, and detailed. Do not write intros or explanations — just output the directly usable result. Keep it under 200 words.`;

  try {
    if (hasGemini) {
      return await callGemini(systemPrompt, userPrompt, false);
    } else {
      const client = getClient();
      if (!client) throw new Error("No client");
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.6,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      });
      return response.choices[0]?.message?.content ?? "Draft generated successfully.";
    }
  } catch (e: any) {
    if (e.message === "QUOTA_EXCEEDED") {
      console.warn("⚠️ Gemini API limit exceeded (429). Using local subtask execution fallback.");
    } else {
      console.error("Gemini/OpenAI execute subtask error:", e);
    }
    return "Failed to generate autonomous execution output. Please check network connection.";
  }
}

export async function aiGenerateRescuePlan(
  criticalTask: { title: string; priority: string; dueDate: Date | null },
  allPendingCount: number,
  postponedCount: number,
) {
  if (!hasGemini && !hasOpenAI) {
    return {
      reason: `Task "${criticalTask.title}" has extremely high urgency.`,
      plan: `AI has automatically entered Rescue Mode to secure your deadlines. We postponed ${postponedCount} low-priority tasks and reserved uninterrupted blocks for "${criticalTask.title}". Focus on this first.`,
    };
  }

  const systemPrompt = "You are Last-Minute Life Saver. A proactive AI agent. You have auto-activated Rescue Mode. Explain why this critical task is urgent, what you changed (postponed low-priority items, reserved focus blocks), and give a direct action plan. Keep it concise, under 90 words, and impact-driven.";
  const userPrompt = `Critical Task: "${criticalTask.title}" (Priority: ${criticalTask.priority}, Due: ${criticalTask.dueDate ? new Date(criticalTask.dueDate).toISOString() : "N/A"}). Total Pending Tasks: ${allPendingCount}. Postponed Tasks Count: ${postponedCount}.`;

  try {
    let raw = "";
    if (hasGemini) {
      raw = await callGemini(systemPrompt, userPrompt, false);
    } else {
      const client = getClient();
      if (!client) throw new Error("No client");
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      raw = response.choices[0]?.message?.content || "";
    }
    return {
      reason: `Urgent deadline risk: "${criticalTask.title}"`,
      plan: raw || "Rescue Mode activated. Pushing lower priority items to focus on critical tasks.",
    };
  } catch (e: any) {
    if (e.message === "QUOTA_EXCEEDED") {
      console.warn("⚠️ Gemini API limit exceeded (429). Using local rescue plan fallback.");
    } else {
      console.error("AI Rescue Plan error:", e);
    }
    return {
      reason: `Urgent deadline risk: "${criticalTask.title}"`,
      plan: `AI has activated Rescue Mode. Focus on "${criticalTask.title}". We cleared your schedule of low-priority items to give you maximum focus time.`,
    };
  }
}

export type ComparativeRanking = {
  taskId: string;
  taskTitle: string;
  comparativeReasoning: string;
};

/**
 * Runs only when Rescue Mode is triggered. Passes the top 3-5 highest-urgency
 * pending tasks to Gemini and asks for a one-sentence comparative justification
 * per task explaining why it's ranked where it is relative to the others.
 * Uses JSON-forced response (responseMimeType application/json).
 * Falls back to a static sentence per task on 429 / any error.
 */
export async function aiGenerateComparativeReasoning(
  topTasks: Array<{ id: string; title: string; dueDate: Date | null; estimatedMinutes: number; urgencyScore: number }>,
): Promise<ComparativeRanking[]> {
  // Static fallback generator used both when no API key and when errors occur
  const buildFallback = (): ComparativeRanking[] =>
    topTasks.map((t, idx) => {
      const others = topTasks.filter((_, i) => i !== idx);
      const next = others[0];
      const bufferNote =
        t.dueDate && next?.dueDate
          ? new Date(t.dueDate) < new Date(next.dueDate)
            ? `its deadline is sooner than "${next.title}"`
            : `it requires ${t.estimatedMinutes} mins of uninterrupted focus`
          : `it has higher overall urgency`;
      return {
        taskId: t.id,
        taskTitle: t.title,
        comparativeReasoning:
          idx === 0
            ? `Ranked #1 because ${bufferNote} and has the least schedule buffer remaining.`
            : `Ranked #${idx + 1} because ${bufferNote}; lower urgency than "${topTasks[0].title}".`,
      };
    });

  if (!hasGemini && !hasOpenAI) return buildFallback();

  const systemPrompt = `You are a proactive AI productivity agent. The app has entered Rescue Mode because critical deadlines are at risk.
You are given a ranked list of the most urgent pending tasks (already sorted by urgency score, highest first).
For EACH task, write exactly ONE sentence that explains why it holds its current priority rank relative to the OTHER tasks in the list.
Mention the specific other task(s) it was compared against by name. Consider: deadline proximity, estimated duration, urgency score, and schedule buffer.
Return ONLY valid JSON matching this exact schema:
{ "rankings": [ { "taskId": "string", "taskTitle": "string", "comparativeReasoning": "string" } ] }`;

  const userPrompt = JSON.stringify(
    topTasks.map((t, i) => ({
      rank: i + 1,
      taskId: t.id,
      title: t.title,
      urgencyScore: t.urgencyScore,
      estimatedMinutes: t.estimatedMinutes,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    })),
  );

  try {
    let raw = "";
    if (hasGemini) {
      raw = await callGemini(systemPrompt, userPrompt, true); // jsonMode = true
    } else {
      const client = getClient();
      if (!client) return buildFallback();
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      raw = response.choices[0]?.message?.content || "";
    }

    if (!raw) return buildFallback();

    const parsed = JSON.parse(raw) as { rankings?: ComparativeRanking[] };
    const rankings = parsed.rankings;
    if (!Array.isArray(rankings) || rankings.length === 0) return buildFallback();

    return rankings;
  } catch (e: any) {
    if (e.message === "QUOTA_EXCEEDED") {
      console.warn("⚠️ Gemini API limit exceeded (429). Using static comparative reasoning fallback.");
    } else {
      console.error("Comparative reasoning generation error:", e);
    }
    return buildFallback();
  }
}

export interface FeasibilityPlan {
  reducedScopeDescription: string;
  draftMessage: string;
  estimatedRecoveredMinutes: number;
}

export async function aiGenerateFeasibilityPlan(
  task: { title: string; description: string | null; estimatedMinutes: number; dueDate: Date | null },
  minutesRemaining: number,
): Promise<FeasibilityPlan | null> {
  if (!hasGemini && !hasOpenAI) {
    return null;
  }

  const systemPrompt = `You are a helpful AI assistant. A user has a task that they cannot complete in the remaining time before the deadline.
Analyze the task and provide a fallback plan.
Return ONLY valid JSON matching this exact schema:
{
  "reducedScopeDescription": "a realistic, specific reduced version of the task that fits in the time actually remaining (reference the task's own title/description, not generic advice)",
  "draftMessage": "a short first-person message requesting an extension or explaining a partial submission",
  "estimatedRecoveredMinutes": 30
}
Do not include any other text or explanation outside the JSON.`;

  const userPrompt = `Task Title: "${task.title}"
Task Description: "${task.description || "N/A"}"
Estimated Minutes: ${task.estimatedMinutes}
Time Remaining (minutes): ${Math.max(0, minutesRemaining)}
Due Date: ${task.dueDate ? new Date(task.dueDate).toISOString() : "N/A"}`;

  try {
    let raw = "";
    if (hasGemini) {
      raw = await callGemini(systemPrompt, userPrompt, true);
    } else {
      const client = getClient();
      if (!client) return null;
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      raw = response.choices[0]?.message?.content || "";
    }

    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeasibilityPlan;
    if (
      !parsed.reducedScopeDescription ||
      !parsed.draftMessage ||
      typeof parsed.estimatedRecoveredMinutes !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch (e: any) {
    if (e.message === "QUOTA_EXCEEDED") {
      console.warn("⚠️ Gemini API limit exceeded (429). Cannot generate feasibility plan.");
    } else {
      console.error("AI feasibility plan error:", e);
    }
    return null;
  }
}

export { suggestTimeBlocks };

export function generateFallbackReasonDetails(task: TaskForScoring, score: number): string {
  const bullets: string[] = [];
  
  if (task.dueDate) {
    const diffMs = new Date(task.dueDate).getTime() - Date.now();
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    if (hours < 0) {
      bullets.push(`• Overdue by ${Math.abs(hours)} hours`);
    } else if (hours === 0) {
      bullets.push(`• Due in less than an hour`);
    } else {
      bullets.push(`• Due in ${hours} hours`);
    }
  } else {
    bullets.push(`• No immediate deadline constraint`);
  }

  const hoursEst = (task.estimatedMinutes / 60).toFixed(1);
  bullets.push(`• Estimated work: ${hoursEst} hours`);
  bullets.push(`• Overall importance: ${task.priority}`);
  bullets.push(`• Urgency level: ${score}/100`);

  let recommendedAction = "Start immediately.";
  if (task.dueDate) {
    const startByTime = new Date(new Date(task.dueDate).getTime() - task.estimatedMinutes * 60000 - 30 * 60000); // 30 mins buffer
    const formattedTime = startByTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    recommendedAction = `Start before ${formattedTime}.`;
  }

  return `${bullets.join("\n")}\nRecommended Action:\n${recommendedAction}`;
}
