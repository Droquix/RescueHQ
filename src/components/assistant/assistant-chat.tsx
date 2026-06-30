"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

type Message = { role: "user" | "assistant"; content: string };

const quickPrompts = [
  "What should I focus on right now?",
  "Help me plan my afternoon",
  "I'm overwhelmed — rescue me",
  "Break down my most urgent task",
];

export function AssistantChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I'm your Last-Minute Life Saver. Tell me what's slipping — I'll prioritize, plan, and push you to act.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg = text.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.response }]);
      if (data.actions && data.actions.length > 0) {
        router.refresh();
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Something went wrong. Try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleVoice() {
    type SpeechRecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
      onerror: (() => void) | null;
      start: () => void;
    };

    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };

    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (listening) {
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
    };
    recognition.onerror = () => setListening(false);

    recognition.start();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2 flex flex-col min-h-[560px]">
        <CardHeader
          title="AI productivity coach"
          subtitle="Context-aware — knows your tasks and deadlines"
        />
        <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-2">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <Bot className="h-4 w-4 text-accent" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-accent text-white"
                    : "bg-surface-muted text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <p className="text-sm text-muted animate-pulse-soft">Thinking...</p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-4 flex gap-2 border-t border-border pt-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Ask for help prioritizing, scheduling..."
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
          />
          <Button
            variant="secondary"
            onClick={toggleVoice}
            className={listening ? "bg-accent/20 text-accent" : ""}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button onClick={() => sendMessage(input)} disabled={loading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Quick prompts" subtitle="Voice or tap" />
        <ul className="space-y-2">
          {quickPrompts.map((prompt) => (
            <li key={prompt}>
              <button
                onClick={() => sendMessage(prompt)}
                className="w-full rounded-xl border border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-muted"
              >
                {prompt}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-xl bg-surface-muted p-4 text-xs text-muted">
          <p className="font-medium text-foreground">Voice-enabled</p>
          <p className="mt-1">
            Tap the mic and speak naturally. Works best in Chrome/Edge with microphone access.
          </p>
        </div>
      </Card>
    </div>
  );
}
