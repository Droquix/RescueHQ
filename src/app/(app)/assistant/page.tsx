import { AssistantChat } from "@/components/assistant/assistant-chat";

export default function AssistantPage() {
  return (
    <div className="space-y-6 animate-slide-up">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">AI Coach</h1>
        <p className="mt-1 text-muted">
          Voice-enabled assistance that plans, prioritizes, and pushes you toward action — not passive alerts.
        </p>
      </header>
      <AssistantChat />
    </div>
  );
}
