import { Sidebar } from "@/components/layout/sidebar";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());

  return (
    <div className="flex min-h-screen">
      <Sidebar hasOpenAI={hasOpenAI} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
