import { getAnalytics } from "@/actions/tasks";
import { AnalyticsDashboard } from "@/components/tasks/analytics-dashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const stats = await getAnalytics();

  return (
    <div className="space-y-6 animate-slide-up">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Productivity Analytics</h1>
        <p className="mt-1 text-muted">
          Track how AI is helping you beat deadlines and build momentum.
        </p>
      </header>
      <AnalyticsDashboard stats={stats} />
    </div>
  );
}
